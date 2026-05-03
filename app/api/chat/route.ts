import { streamText, tool, convertToModelMessages } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.groq_key || "",
})

const braveSearchKey = process.env.brave_search || ""

export const maxDuration = 30

// Helper function to search jobs using Brave Search API
async function searchJobsWithBrave(query: string): Promise<string> {
  if (!braveSearchKey) {
    return "Brave Search API key not configured. Please add brave_search to your environment variables."
  }

  try {
    const response = await fetch("https://api.search.brave.com/res/v1/web/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Subscription-Token": braveSearchKey,
      },
      body: JSON.stringify({
        q: query,
        count: 5,
      }),
    })

    if (!response.ok) {
      console.error("[v0] Brave Search error:", response.status, response.statusText)
      return `Search failed: ${response.statusText}`
    }

    const data = await response.json()
    
    // Extract job listings from search results
    const results = (data.web || [])
      .slice(0, 5)
      .map((result: any) => ({
        title: result.title,
        url: result.url,
        description: result.description,
      }))

    if (results.length === 0) {
      return "No job results found. Try a more specific search query."
    }

    return JSON.stringify(results, null, 2)
  } catch (error) {
    console.error("[v0] Brave Search error:", error)
    return `Error searching jobs: ${error instanceof Error ? error.message : "Unknown error"}`
  }
}

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: `You are a Career Strategist AI assistant helping users find real job opportunities.

WORKFLOW:
1. When user asks for jobs, FIRST call search_jobs with a relevant query (e.g., "javascript developer jobs remote").
2. THEN review the search results and identify the best 1-3 matches.
3. For each good match, call add_to_kanban ONCE with real job data from the search results.
4. After adding jobs, respond with text explaining what you found and added.

STRICT RULES:
- Call search_jobs first to get REAL job data.
- NEVER add_to_kanban more than 2 times per request.
- NEVER make up or hallucinate jobs - only use search results.
- Be honest about match percentages based on job description.
- Stop after adding jobs - do not call more tools.`,
      messages: await convertToModelMessages(messages),
      maxSteps: 4, // search_jobs (1 step) + add_to_kanban x2 (2 steps) + response
      tools: {
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

        // add_to_kanban has no execute function — handled client-side via onToolCall
        add_to_kanban: tool({
          description:
            "Add a job opportunity to the user's Kanban board in the Discovered column.",
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
        }),
      },
    })

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
