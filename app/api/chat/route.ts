import { streamText, tool, convertToModelMessages } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Check for API key at request time (not module load time)
    const apiKey = process.env.gemini_key
    console.log("[v0] API Key check - gemini_key exists:", !!apiKey)
    console.log("[v0] Available env vars:", Object.keys(process.env).filter(k => k.toLowerCase().includes('gemini') || k.toLowerCase().includes('google')))
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: "Missing gemini_key environment variable. Please add it in Settings > Vars." 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
    })

    const { messages } = await req.json()
    console.log("[v0] Messages received:", messages.length)

    const result = streamText({
      model: google("gemini-3-flash"),
      system:
        "You are an autonomous Career Strategist. Extract skills, search for jobs, and save matches using your tools.",
      messages: await convertToModelMessages(messages),
      tools: {
        // TODO: Inject Brave MCP Tool Here

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
