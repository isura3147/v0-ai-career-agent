import { streamText, tool, convertToModelMessages } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.groq_key || "",
})

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: `You are a Career Strategist AI assistant helping users find job opportunities.

STRICT RULES - YOU MUST FOLLOW THESE:
1. When asked to add "a job" (singular), call add_to_kanban EXACTLY ONCE, then STOP and respond with text.
2. When asked to add "jobs" (plural), call add_to_kanban AT MOST 2 times, then STOP and respond with text.
3. NEVER call add_to_kanban more than 2 times in a single response.
4. After ANY tool call, you MUST respond with a text summary. Do NOT call more tools.
5. If you don't have real job data, create realistic example jobs but be honest they are examples.
6. Be conversational and explain why jobs match the user's profile.`,
      messages: await convertToModelMessages(messages),
      maxSteps: 2, // Strict limit: 1 tool call + 1 response
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
