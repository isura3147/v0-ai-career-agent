import { streamText, tool, convertToModelMessages, stepCountIs } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.groq_key || "",
})

export const maxDuration = 30

// --------------------------------------------------------------------------
// Brave Search helper — uses GET with URL params and a fetch timeout
// --------------------------------------------------------------------------
async function searchJobsWithBrave(query: string): Promise<string> {
  const braveSearchKey = process.env.brave_search || ""

  console.log("[v0] searchJobsWithBrave called with query:", query)
  console.log("[v0] Brave API key present:", !!braveSearchKey)

  if (!braveSearchKey) {
    return "Brave Search API key not configured. Please add brave_search to your environment variables."
  }

  // Build URL with query params
  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", query)
  url.searchParams.set("count", "5")

  console.log("[v0] Brave Search URL:", url.toString())

  try {
    // 10 second timeout so the agent never hangs forever
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": braveSearchKey,
      },
      signal: AbortSignal.timeout(10_000),
    })

    console.log("[v0] Brave Search response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Brave Search error body:", errorText)
      return `Search failed (${response.status}): ${errorText.slice(0, 200)}`
    }

    const data = await response.json()
    const rawResults = data?.web?.results ?? []
    console.log("[v0] Brave Search returned", rawResults.length, "results")

    if (rawResults.length === 0) {
      return "No results found. Try a more specific search query."
    }

    const results = rawResults.slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }))

    return JSON.stringify(results, null, 2)
  } catch (error) {
    console.error("[v0] Brave Search exception:", error)
    if (error instanceof Error && error.name === "TimeoutError") {
      return "Search timed out after 10 seconds. The Brave Search API may be slow."
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
  console.log("[v0] groq_key present:", !!process.env.groq_key)

  try {
    const { messages } = await req.json()
    console.log("[v0] Received", messages?.length ?? 0, "messages")

    const kanbanCount = countKanbanCalls(messages)
    console.log("[v0] add_to_kanban calls already in history:", kanbanCount)

    // Hard cap: max 2 jobs per conversation turn
    const KANBAN_LIMIT = 2
    const kanbanLimitReached = kanbanCount >= KANBAN_LIMIT

    if (kanbanLimitReached) {
      console.log("[v0] Kanban limit reached — removing add_to_kanban tool")
    }

    // Build tools dynamically — drop add_to_kanban once the user already
    // has enough jobs in this turn.
    const toolset: Record<string, any> = {
      search_jobs: tool({
        description:
          "Search for real job opportunities using Brave Search. Returns actual job listings from the web.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("Search query for jobs (e.g., 'senior react developer remote jobs')"),
        }),
        execute: async ({ query }) => {
          return await searchJobsWithBrave(query)
        },
      }),
    }

    if (!kanbanLimitReached) {
      toolset.add_to_kanban = tool({
        description:
          "Add a job opportunity to the user's Kanban board in the Discovered column. Call this AT MOST ONCE per request.",
        inputSchema: z.object({
          title: z.string().describe("The job title"),
          company: z.string().describe("The company name"),
          link: z.string().describe("URL to the job posting"),
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
      model: groq("mixtral-8x7b-32768"),
      system: `You are a Career Strategist AI assistant helping users find real job opportunities.

WORKFLOW:
1. When the user asks for jobs, FIRST call search_jobs with a relevant query (e.g., "javascript developer jobs remote").
2. Pick THE SINGLE BEST match from the search results.
3. Call add_to_kanban EXACTLY ONCE with that job's real data.
4. Then RESPOND WITH A TEXT MESSAGE describing what you found and added. Do NOT call any more tools.

STRICT RULES:
- Call search_jobs first to get REAL job data. NEVER hallucinate jobs.
- Call add_to_kanban AT MOST ONCE per user request.
- After add_to_kanban returns its result, your next output MUST be plain text — no more tool calls.
- If the user asks for "more jobs", they need to send a new message.
- ${kanbanLimitReached ? "The user has reached the maximum jobs for this turn. Respond with text only." : ""}`,
      messages: await convertToModelMessages(messages),
      // Hard ceiling on server-side step loop
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
