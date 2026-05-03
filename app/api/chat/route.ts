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
      system: `You are an autonomous Career Strategist AI assistant. Your job is to help users find relevant job opportunities based on their skills and experience.

IMPORTANT RULES:
- When the user asks you to find or add jobs, add AT MOST 3 jobs per request using the add_to_kanban tool.
- After adding jobs, STOP and summarize what you added. Do NOT keep adding more jobs.
- Only call add_to_kanban when you have specific job details to add.
- If the user hasn't shared their resume or skills yet, ask them first before searching for jobs.
- Be conversational and helpful. Explain why each job is a good match.
- If you don't have real job data, you can suggest example roles but be honest that they are illustrative examples.`,
      messages: await convertToModelMessages(messages),
      maxSteps: 5, // Limit tool call loops to prevent runaway behavior
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
