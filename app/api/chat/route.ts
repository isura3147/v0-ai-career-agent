import { streamText, tool, convertToModelMessages } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { z } from "zod"

console.log("[v0] Checking environment variables...")
console.log("[v0] gemini_key present:", !!process.env.gemini_key)
console.log("[v0] GOOGLE_GENERATIVE_AI_API_KEY present:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY)

const apiKey = process.env.gemini_key || process.env.GOOGLE_GENERATIVE_AI_API_KEY
console.log("[v0] Using API key:", apiKey ? "✓ Found" : "✗ Missing")

const google = createGoogleGenerativeAI({
  apiKey: apiKey,
})

export const maxDuration = 30

export async function POST(req: Request) {
  console.log("[v0] POST /api/chat called")

  try {
    const { messages } = await req.json()
    console.log("[v0] Received messages:", JSON.stringify(messages, null, 2))

    const result = streamText({
      model: google("gemini-1.5-flash"),
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

    console.log("[v0] streamText called successfully")
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
