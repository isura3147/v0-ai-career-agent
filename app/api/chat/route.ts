import { streamText, tool, convertToModelMessages } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Read API key at request time to pick up hot-reloaded env vars
    const apiKey = process.env.gemini_key
    const braveSearchKey = process.env.brave_search || ""
    
    if (!apiKey) {
      console.error("[v0] gemini_key is not set. Available env vars:", Object.keys(process.env).slice(0, 20))
      return new Response(
        JSON.stringify({ 
          error: "gemini_key environment variable is not configured. Please add it in Settings > Vars and restart the preview." 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const google = createGoogleGenerativeAI({ apiKey })
    
    const { messages } = await req.json()

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system:
        "You are an autonomous Career Strategist. Extract skills, search for jobs, and save matches using your tools.",
      messages: await convertToModelMessages(messages),
      tools: {
        // TODO: Inject Brave MCP Tool Here (use braveSearchKey for API calls)

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
