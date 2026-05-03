"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { Send, Bot, User, Loader2, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// --------------------------------------------------------------------------
// Tool Invocation Pill
// --------------------------------------------------------------------------
function ToolPill({ toolName, state }: { toolName: string; state: string }) {
  const icons: Record<string, string> = {
    search_jobs: "🔍",
    add_jobs_batch: "✨",
    add_to_kanban: "✨",
    analyze_skills: "🧠",
    fetch_job_details: "📄",
  }
  const icon = icons[toolName] ?? "⚙️"
  const isLoading = state === "input-streaming" || state === "input-available"

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border w-fit text-xs font-mono text-muted-foreground">
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin text-primary" />
      ) : (
        <span className="text-[11px]">{icon}</span>
      )}
      <span className={cn(isLoading ? "text-primary" : "text-muted-foreground")}>
        {isLoading ? `Calling ${toolName}…` : `${toolName} executed`}
      </span>
      {!isLoading && (
        <span className="w-1.5 h-1.5 rounded-full bg-chart-2 inline-block" />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Helper to extract text from UIMessage parts
// --------------------------------------------------------------------------
function getMessageText(parts: Array<{ type: string; text?: string }> | undefined): string {
  if (!parts || !Array.isArray(parts)) return ""
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
}

// --------------------------------------------------------------------------
// Message Bubble
// --------------------------------------------------------------------------
function MessageBubble({
  message,
}: {
  message: {
    id: string
    role: string
    parts?: Array<{
      type: string
      text?: string
      toolInvocation?: { toolName: string; state: string }
      toolName?: string
      state?: string
    }>
  }
}) {
  const isUser = message.role === "user"
  const parts = message.parts ?? []



  // Separate text parts from tool invocation parts
  // AI SDK 6 uses type: "tool-invocation" with toolName and state directly on the part
  const textContent = getMessageText(parts)
  const toolParts = parts.filter(
    (p) => p.type === "tool-invocation"
  )

  // If there are only tool invocations, render them
  if (!textContent && toolParts.length > 0) {
    return (
      <div className="flex flex-col gap-2 pl-8">
        {toolParts.map((part, i) => (
          <ToolPill
            key={i}
            toolName={part.toolName ?? part.toolInvocation?.toolName ?? "unknown"}
            state={part.state ?? part.toolInvocation?.state ?? "input-available"}
          />
        ))}
      </div>
    )
  }

  // Otherwise, render the text bubble (and any tool invocations below it)
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
            isUser ? "bg-primary/20 border border-primary/40" : "bg-secondary border border-border"
          )}
        >
          {isUser ? (
            <User className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary/15 border border-primary/25 text-foreground rounded-tr-sm"
              : "bg-secondary border border-border text-foreground rounded-tl-sm"
          )}
          dangerouslySetInnerHTML={{
            __html: textContent.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
          }}
        />
      </div>
      {toolParts.length > 0 && (
        <div className="flex flex-col gap-2 pl-8">
          {toolParts.map((part, i) => (
            <ToolPill
              key={i}
              toolName={part.toolName ?? part.toolInvocation?.toolName ?? "unknown"}
              state={part.state ?? part.toolInvocation?.state ?? "input-available"}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Types for add_to_kanban tool arguments
// --------------------------------------------------------------------------
export interface AddToKanbanArgs {
  title: string
  company: string
  link: string
  description?: string
  matchPercentage: number
  missingSkills: string[]
}

interface AgentChatProps {
  onAddJob?: (args: AddToKanbanArgs) => void
  resume?: string
}

// --------------------------------------------------------------------------
// Rotating status words shown while the agent is working
// --------------------------------------------------------------------------
const STATUS_WORDS = [
  "Thinking",
  "Searching",
  "Fetching jobs",
  "Analyzing matches",
  "Scoring fit",
  "Reviewing skills",
  "Adding to board",
  "Finalizing",
]

function ThinkingIndicator() {
  const [wordIndex, setWordIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % STATUS_WORDS.length)
    }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-secondary border border-border">
        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="bg-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
        </div>
        <span
          key={wordIndex}
          className="text-sm text-muted-foreground font-mono animate-in fade-in slide-in-from-bottom-1 duration-300"
        >
          {STATUS_WORDS[wordIndex]}…
        </span>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Agent Chat Panel — wired up with useChat()
// --------------------------------------------------------------------------
export function AgentChat({ onAddJob, resume = "" }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  // Keep latest resume in a ref so the transport callback always sees the
  // current value without recreating the transport on every keystroke.
  const resumeRef = useRef(resume)
  useEffect(() => {
    resumeRef.current = resume
  }, [resume])

  const { messages, sendMessage, status, addToolOutput, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Attach the latest resume to every chat request so the agent can
      // tailor matchPercentage and missingSkills to the user's background.
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages,
          id,
          resume: resumeRef.current,
        },
      }),
    }),
    // Automatically continue the conversation after client-side tool execution
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
      console.log("[v0] onToolCall fired:", toolCall.toolName, toolCall)
      // Handle client-side tool execution for add_jobs_batch (single batched call).
      if (toolCall.toolName === "add_jobs_batch") {
        const input = toolCall.input as { jobs?: AddToKanbanArgs[] }
        const jobs = Array.isArray(input?.jobs) ? input.jobs : []
        console.log("[v0] Adding", jobs.length, "jobs to kanban")
        for (const job of jobs) {
          onAddJob?.(job)
        }
        addToolOutput({
          tool: "add_jobs_batch",
          toolCallId: toolCall.toolCallId,
          output: { success: true, count: jobs.length },
        })
      }
    },
  })

  const isStreaming = status === "streaming" || status === "submitted"

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isStreaming ? "bg-primary animate-pulse" : "bg-chart-2"
          )}
        />
        <span className="text-sm font-semibold text-foreground tracking-wide">AI Career Agent</span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded-full border border-border">
          {isStreaming ? "thinking…" : "online"}
        </span>
      </div>

      {/* Scrollable messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
        {messages.length === 0 && !error && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Ask the agent to find jobs, analyze skill gaps, or add matches to your board.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <strong>Error:</strong> {error.message}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming &&
          (() => {
            // Show "Thinking…" bubble whenever we're streaming and the assistant
            // hasn't started producing visible text yet.
            const last = messages[messages.length - 1]
            const lastIsAssistantWithText =
              last?.role === "assistant" && getMessageText(last.parts as any).trim().length > 0
            if (!lastIsAssistantWithText) return <ThinkingIndicator />
            return null
          })()}
        <div ref={bottomRef} />
      </div>

      {/* Sticky input */}
      <div className="px-3 py-3 border-t border-border shrink-0 flex gap-2">
        <Input
          placeholder="Ask the agent to find jobs, analyze gaps…"
          className="flex-1 bg-input border-border text-foreground text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            size="icon"
            onClick={() => stop()}
            className="shrink-0 bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
            title="Stop agent"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
