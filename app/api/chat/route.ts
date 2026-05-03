import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"
import PQueue from "p-queue"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
})

export const maxDuration = 61

// --------------------------------------------------------------------------
// Request queue to prevent bursts that trigger rate limits.
// Concurrency of 1 ensures only one LLM call at a time.
// --------------------------------------------------------------------------
const llmQueue = new PQueue({ concurrency: 1 })

// --------------------------------------------------------------------------
// Exponential backoff helper
// --------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let delay = 1000
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const isRateLimit =
        err instanceof Error && /rate.?limit|429|too many/i.test(err.message)
      if (i === retries - 1 || !isRateLimit) throw err
      console.log(`[v0] Rate limited, retrying in ${delay}ms (attempt ${i + 2}/${retries})`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error("Retry limit exceeded")
}

// --------------------------------------------------------------------------
// Tavily Search helper — free tier, 1,000 searches/month, designed for AI agents
// --------------------------------------------------------------------------
async function searchJobsWithTavily(query: string): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY || ""

  console.log("[v0] searchJobsWithTavily called with query:", query)
  console.log("[v0] Tavily API key present:", !!tavilyKey)

  if (!tavilyKey) {
    return "Tavily Search API key not configured. Please add TAVILY_API_KEY to your environment variables."
  }

  try {
    // 10 second timeout so the agent never hangs forever
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        max_results: 10,
        exclude_domains: [
          "indeed.com",
          "linkedin.com",
          "glassdoor.com",
          "ziprecruiter.com",
          "builtin.com",
          "dice.com",
          "monster.com",
          "simplyhired.com",
          "adzuna.com",
        ],
        include_answer: false,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    console.log("[v0] Tavily Search response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Tavily Search error body:", errorText)
      return `Search failed (${response.status}): ${errorText.slice(0, 200)}`
    }

    const data = await response.json()
    const rawResults = data?.results ?? []
    console.log("[v0] Tavily Search returned", rawResults.length, "results")

    if (rawResults.length === 0) {
      return "No results found. Try a more specific search query."
    }

    // Pass up to 10 results to the LLM so it has a wide pool to pick the best 3 from.
    const results = rawResults.map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.content || r.snippet || "",
    }))

    return JSON.stringify(results, null, 2)
  } catch (error) {
    console.error("[v0] Tavily Search exception:", error)
    if (error instanceof Error && error.name === "TimeoutError") {
      return "Search timed out after 10 seconds. The Tavily Search API may be slow."
    }
    return `Error searching jobs: ${error instanceof Error ? error.message : "Unknown error"}`
  }
}

// --------------------------------------------------------------------------
// Detect whether the assistant has already batched jobs onto the board in
// this conversation turn. Used to enforce a hard cap and prevent runaway
// tool-calling loops.
// --------------------------------------------------------------------------
function hasBatchedJobs(messages: any[]): boolean {
  for (const msg of messages ?? []) {
    const parts = msg.parts ?? []
    for (const part of parts) {
      const toolName =
        part.toolName ??
        part.toolInvocation?.toolName ??
        (part.type?.startsWith("tool-") ? part.type.replace(/^tool-/, "") : undefined)
      if (toolName === "add_jobs_batch") {
        return true
      }
    }
  }
  return false
}

export async function POST(req: Request) {
  console.log("[v0] POST /api/chat — start")
  console.log("[v0] GOOGLE_GENERATIVE_AI_API_KEY present:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  console.log("[v0] TAVILY_API_KEY present:", !!process.env.TAVILY_API_KEY)

  try {
    const { messages, resume, location, isRemote } = await req.json()
    const resumeText = typeof resume === "string" ? resume.trim() : ""
    console.log("[v0] Received", messages?.length ?? 0, "messages")
    console.log("[v0] Resume present:", !!resumeText, "length:", resumeText.length)
    console.log("[v0] Preferences - Location:", location, "Remote:", isRemote)

    // Hard cap: max 3 jobs per batch (matches Tavily max_results).
    const KANBAN_LIMIT = 3

    const toolset: Record<string, any> = {
      search_jobs: tool({
        description:
          "Search for real job opportunities using Tavily Search. Returns actual job listings from the web.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("Search query for jobs (e.g., 'Junior React frontend remote jobs in Sri Lanka')"),
        }),
        execute: async ({ query }) => {
          return await searchJobsWithTavily(query)
        },
      }),
    }

    const jobSchema = z.object({
      title: z.string().describe("The job title"),
      company: z.string().describe("The company name"),
      link: z.string().describe("URL to the job posting"),
      description: z
        .string()
        .describe(
          "A 2-4 sentence summary of the role, key responsibilities, and required skills. Pulled from the search result content."
        ),
      matchPercentage: z
        .number()
        .describe("How well the job matches the user's skills (0-100)"),
      missingSkills: z
        .array(z.string())
        .describe("Skills the user is missing for this role"),
    })

    toolset.add_jobs_batch = tool({
      description: `Add ALL relevant job opportunities from the search results to the user's Kanban board in a SINGLE call. Pass an array of up to ${KANBAN_LIMIT} jobs. Call this tool EXACTLY ONCE — never more than once.`,
      inputSchema: z.object({
        jobs: z
          .array(jobSchema)
          .min(1)
          .max(3)
          .describe(`Array of up to 3 jobs to add to the board, scored against the user's resume.`),
      }),
    })

    // Queue and retry the LLM call to reduce rate limit errors
    const result = await llmQueue.add(() =>
      withRetry(async () =>
        streamText({
          model: google("gemini-3.1-flash-lite-preview"),
          system: `You are an elite Career Strategist AI assistant helping users find highly relevant job opportunities.

${resumeText
              ? `=== USER RESUME ===
${resumeText}
=== END RESUME ===

CRITICAL: You MUST use the resume above as the absolute GROUND TRUTH. Extract the user's core skills, frameworks, and crucially, their YEARS OF EXPERIENCE (YoE). If they are entry-level/junior, you MUST NOT search for senior roles.`
              : "NOTE: The user has not provided a resume yet. Suggest they add one for better matches."
            }

User Preferences:
- Location: ${location || "Not specified (assume global/any unless remote is selected)"}
- Remote Only: ${isRemote ? "YES (You MUST include 'remote' in the search query)" : "NO"}

WORKFLOW (Sequential steps):
STEP 1. Analyze the user's resume/message and call the \`search_jobs\` tool. Your query MUST be highly specific:
        - Include the exact level (e.g., "Junior", "Entry Level", "Intern", "Mid-level") based on the resume. DO NOT search for senior jobs if the resume is junior.
        - Include the location if specified (e.g., "in Sri Lanka").
        - Include "remote" if Remote Only is YES.
        - Example query: "Junior React Developer remote jobs in Sri Lanka"
STEP 2. Wait for the \`search_jobs\` results.
STEP 3. Call \`add_jobs_batch\` with an array of up to 3 specific job postings based strictly on the actual search results. ONLY select direct job listings. IGNORE generic job search results or aggregators. Do NOT make up jobs.
STEP 4. After \`add_jobs_batch\` completes, stop and reply to the user.

For EACH job in the add_jobs_batch array:
- Compute matchPercentage HONESTLY based on how well the job requirements match the user's resume skills AND experience level. If a job requires 5+ years and the user has 1, score it very low (e.g. 10-20%).
- Populate missingSkills with specific skills required by the job but missing from the resume.
- Include a 2-4 sentence description summarizing the role based on the search result.
- Use the exact URL from the search results.

STRICT RULES:
- DO NOT call \`add_jobs_batch\` until you have the results from \`search_jobs\`. (No parallel tool calling).
- NEVER hallucinate jobs.
- Match scoring MUST reflect the actual resume.`,
          messages: await convertToModelMessages(messages),
          // Hard ceiling: 1 search_jobs + 1 add_jobs_batch = 2 tool steps, stop after.
          stopWhen: stepCountIs(3),
          tools: toolset,
          onStepFinish: ({ toolCalls, finishReason }) => {
            console.log(
              "[v0] step finished — reason:",
              finishReason,
              "toolCalls:",
              toolCalls?.map((t) => t.toolName),
            )
          },
        })
      )
    )

    if (!result) {
      throw new Error("Failed to get response from LLM")
    }

    console.log("[v0] streamText started — returning UI message stream")
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[v0] API error:", error)
    const raw = error instanceof Error ? error.message : String(error)

    // Produce a human-friendly message for common failure modes
    let friendly = "Something went wrong. Please try again."
    if (/rate.?limit|too many requests|429/i.test(raw)) {
      friendly = "The AI model is currently rate-limited. Please wait 30–60 seconds and try again."
    } else if (/timeout|timed out/i.test(raw)) {
      friendly = "The request timed out. Please try again."
    } else if (/api.?key|unauthorized|401/i.test(raw)) {
      friendly = "API key error — please check your environment variables."
    }

    return new Response(JSON.stringify({ error: friendly }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
