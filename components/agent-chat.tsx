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
  const labels: Record<string, string> = {
    search_jobs: "Searching jobs",
    add_jobs_batch: "Adding to board",
    add_to_kanban: "Adding to board",
    analyze_skills: "Analyzing skills",
    fetch_job_details: "Fetching details",
  }
  const label = labels[toolName] ?? toolName
  const isLoading = state === "input-streaming" || state === "input-available"

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border w-fit text-xs font-mono text-muted-foreground">
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin text-primary" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
      )}
      <span className={cn(isLoading ? "text-primary" : "text-muted-foreground")}>
        {isLoading ? `${label}…` : `${label} done`}
      </span>
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

  const textContent = getMessageText(parts)
  const toolParts = parts.filter((p) => p.type === "tool-invocation")

  // Tool-only message — show pills inline
  if (!textContent && toolParts.length > 0) {
    return (
      <div className="flex flex-col gap-2 pl-10">
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

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
        {/* Avatar */}
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border",
            isUser
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          {isUser ? (
            <User className="w-3.5 h-3.5" />
          ) : (
            <Bot className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground border border-border rounded-tl-sm"
          )}
          dangerouslySetInnerHTML={{
            __html: textContent.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
          }}
        />
      </div>

      {/* Tool pills below the text bubble */}
      {toolParts.length > 0 && (
        <div className="flex flex-col gap-2 pl-10">
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
// Types
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
// Rotating loading indicator
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
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted border border-border">
        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-3">
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
// Agent Chat Panel
// --------------------------------------------------------------------------
export function AgentChat({ onAddJob, resume = "" }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  const resumeRef = useRef(resume)
  useEffect(() => {
    resumeRef.current = resume
  }, [resume])

  const { messages, sendMessage, status, addToolOutput, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages,
          id,
          resume: resumeRef.current,
        },
      }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
      if (toolCall.toolName === "add_jobs_batch") {
        const inp = toolCall.input as { jobs?: AddToKanbanArgs[] }
        const jobs = Array.isArray(inp?.jobs) ? inp.jobs : []
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-h-0 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-muted/40">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isStreaming ? "bg-primary animate-pulse" : "bg-emerald-500"
          )}
        />
        <span className="text-sm font-semibold text-foreground">AI Career Agent</span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono bg-background border border-border px-2 py-0.5 rounded-full">
          {isStreaming ? "working…" : "online"}
        </span>
      </div>

      {/* Scrollable messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0 bg-background">
        {messages.length === 0 && !error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
              Ask the agent to find jobs that match your resume, or search for specific roles.
            </p>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <strong>Error:</strong> {error.message}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming &&
          (() => {
            const last = messages[messages.length - 1]
            const lastIsAssistantWithText =
              last?.role === "assistant" && getMessageText(last.parts as any).trim().length > 0
            if (!lastIsAssistantWithText) return <ThinkingIndicator />
            return null
          })()}
        <div ref={bottomRef} />
      </div>

      {/* Sticky input */}
      <div className="px-3 py-3 border-t border-border shrink-0 flex gap-2 bg-card">
        <Input
          placeholder="Ask the agent to find jobs, search by role, or explore opportunities…"
          className="flex-1 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={() => stop()}
            className="shrink-0"
            title="Stop agent"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
