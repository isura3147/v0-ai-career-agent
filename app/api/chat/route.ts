import { streamText, tool, convertToModelMessages } from "ai"
import { z } from "zod"

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: "openai/gpt-4o",
    system:
      "You are an autonomous Career Strategist. Extract skills, search for jobs, and save matches using your tools.",
    messages: await convertToModelMessages(messages),
    tools: {
      // TODO: Inject Brave MCP Tool Here

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
        execute: async (data) => {
          return { success: true, job: data }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
