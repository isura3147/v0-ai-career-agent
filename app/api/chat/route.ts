import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { createCerebras } from "@ai-sdk/cerebras"
import { z } from "zod"

const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY || "",
})

export const maxDuration = 30

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
        max_results: 5,
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

    const results = rawResults.slice(0, 5).map((r: any) => ({
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
// Count how many add_to_kanban calls already exist in the message history.
// Used to enforce a hard cap and prevent runaway tool-calling loops.
// --------------------------------------------------------------------------
function countKanbanCalls(messages: any[]): number {
  let count = 0
  for (const msg of messages ?? []) {
    const parts = msg.parts ?? []
    for (const part of parts) {
      const toolName =
        part.toolName ??
        part.toolInvocation?.toolName ??
        (part.type?.startsWith("tool-") ? part.type.replace(/^tool-/, "") : undefined)
      if (toolName === "add_to_kanban") {
        count++
      }
    }
  }
  return count
}

export async function POST(req: Request) {
  console.log("[v0] POST /api/chat — start")
  console.log("[v0] CEREBRAS_API_KEY present:", !!process.env.CEREBRAS_API_KEY)
  console.log("[v0] TAVILY_API_KEY present:", !!process.env.TAVILY_API_KEY)

  try {
    const { messages, resume } = await req.json()
    const resumeText = typeof resume === "string" ? resume.trim() : ""
    console.log("[v0] Received", messages?.length ?? 0, "messages")
    console.log("[v0] Resume present:", !!resumeText, "length:", resumeText.length)

    const kanbanCount = countKanbanCalls(messages)
    console.log("[v0] add_to_kanban calls already in history:", kanbanCount)

    // Hard cap: max 5 jobs per conversation turn (matches Tavily max_results)
    const KANBAN_LIMIT = 5
    const kanbanLimitReached = kanbanCount >= KANBAN_LIMIT

    if (kanbanLimitReached) {
      console.log("[v0] Kanban limit reached — removing add_to_kanban tool")
    }

    // Build tools dynamically — drop add_to_kanban once the user already
    // has enough jobs in this turn.
    const toolset: Record<string, any> = {
      search_jobs: tool({
        description:
          "Search for real job opportunities using Tavily Search. Returns actual job listings from the web.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("Search query for jobs (e.g., 'senior react developer remote jobs')"),
        }),
        execute: async ({ query }) => {
          return await searchJobsWithTavily(query)
        },
      }),
    }

    if (!kanbanLimitReached) {
      toolset.add_to_kanban = tool({
        description:
          "Add a job opportunity to the user's Kanban board in the Discovered column. Call this ONCE PER JOB you want to add — typically once for each result returned by search_jobs.",
        inputSchema: z.object({
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
        }),
      })
    }

    const result = streamText({
      model: cerebras("qwen-3-235b-a22b-instruct-2507"),
      system: `You are a Career Strategist AI assistant helping users find real job opportunities tailored to their background.

${
  resumeText
    ? `=== USER RESUME ===
${resumeText}
=== END RESUME ===

Use the resume above as the GROUND TRUTH for the user's skills, experience, and background. Every match assessment MUST be based on this resume.`
    : "NOTE: The user has not provided a resume yet. If they ask for jobs without a resume, still help them, but mention they should add their resume to the panel for better-tailored matches."
}

WORKFLOW:
1. When the user asks for jobs, FIRST call search_jobs ONCE with a query that reflects their resume (e.g., if their resume says "5 years React + Node", search "senior react node developer remote jobs").
2. For EACH result returned by search_jobs (up to ${KANBAN_LIMIT}), call add_to_kanban — one call per job. Add ALL of the search results as separate Kanban cards so the user can review them.
3. For each add_to_kanban call, compute matchPercentage HONESTLY against the resume:
   - 90-100 = strong match (most required skills present, right experience level).
   - 70-89 = good match (many skills overlap, minor gaps).
   - 50-69 = partial match (some core skills missing).
   - Below 50 = weak match — still add it but score it low.
4. For each job:
   - Populate missingSkills with the SPECIFIC skills the job requires that are NOT in the user's resume.
   - ALWAYS include the description field with a 2-4 sentence summary of the role, derived from the search result content.
   - ALWAYS pass through the real link from the search result — never fabricate URLs.
5. AFTER all add_to_kanban calls are done, RESPOND WITH A SINGLE TEXT MESSAGE summarizing:
   - How many jobs you added.
   - Which 1-2 are the strongest matches and why.
   - Common skill gaps across the listings.
   Do NOT call any more tools after the summary.

STRICT RULES:
- Call search_jobs ONCE, then make multiple add_to_kanban calls in sequence.
- NEVER hallucinate jobs — only use real search results.
- Call add_to_kanban AT MOST ${KANBAN_LIMIT} times per user request.
- Match scoring MUST reflect the actual resume, not generic estimates.
- After all add_to_kanban calls, your next output MUST be plain text — no more tool calls.
- ${kanbanLimitReached ? "The user has reached the maximum jobs for this turn. Respond with text only." : ""}`,
      messages: await convertToModelMessages(messages),
      // Hard ceiling on server-side step loop:
      // 1 search_jobs + up to 5 add_to_kanban + 1 final summary = 7, give a small buffer.
      stopWhen: stepCountIs(8),
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

    console.log("[v0] streamText started — returning UI message stream")
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[v0] API error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
