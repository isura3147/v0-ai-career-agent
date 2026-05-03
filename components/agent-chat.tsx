"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
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
            __html: textContent
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\n/g, "<br/>"),
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
// Progress bar shown while the agent is working
// --------------------------------------------------------------------------
const PROGRESS_STAGES = [
  { label: "Thinking", target: 15 },
  { label: "Searching jobs", target: 40 },
  { label: "Analyzing matches", target: 65 },
  { label: "Scoring fit", target: 82 },
  { label: "Adding to board", target: 94 },
  { label: "Finalizing", target: 99 },
]

function ProgressIndicator() {
  const [progress, setProgress] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    // Advance progress toward the next stage target, then move to the next stage
    const id = setInterval(() => {
      setProgress((prev) => {
        const stage = PROGRESS_STAGES[stageIndex] ?? PROGRESS_STAGES[PROGRESS_STAGES.length - 1]
        const gap = stage.target - prev
        if (gap <= 0.5) {
          setStageIndex((s) => Math.min(s + 1, PROGRESS_STAGES.length - 1))
          return prev
        }
        // Ease toward target — fast at first, slows near target
        return prev + Math.max(0.4, gap * 0.08)
      })
    }, 120)
    return () => clearInterval(id)
  }, [stageIndex])

  const label = PROGRESS_STAGES[Math.min(stageIndex, PROGRESS_STAGES.length - 1)].label

  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted border border-border">
        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            key={label}
            className="text-xs text-muted-foreground font-mono animate-in fade-in duration-300"
          >
            {label}…
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Detect if a user message is a job search request
// --------------------------------------------------------------------------
const JOB_SEARCH_KEYWORDS = /\b(find|search|look|get|show|fetch|discover|explore|remot|job|role|position|opportunit|hire|hiring|hiring|career)\b/i

function isJobSearchMessage(text: string): boolean {
  return JOB_SEARCH_KEYWORDS.test(text)
}

// --------------------------------------------------------------------------
// Agent Chat Panel
// --------------------------------------------------------------------------
export function AgentChat({ onAddJob, resume = "" }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [location, setLocation] = useState("")
  const [isRemote, setIsRemote] = useState(false)
  // Track whether the current/last request was a job search so we only
  // show the progress bar for job searches, not regular chat messages.
  const [isJobSearch, setIsJobSearch] = useState(false)

  const resumeRef = useRef(resume)
  useEffect(() => {
    resumeRef.current = resume
  }, [resume])

  const locationRef = useRef(location)
  const isRemoteRef = useRef(isRemote)
  useEffect(() => {
    locationRef.current = location
    isRemoteRef.current = isRemote
  }, [location, isRemote])

  const { messages, sendMessage, status, addToolOutput, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages,
          id,
          resume: resumeRef.current,
          location: locationRef.current,
          isRemote: isRemoteRef.current,
        },
      }),
    }),
    // NOTE: We deliberately do NOT set sendAutomaticallyWhen here.
    // That option was what caused the follow-up LLM request after tool calls.
    // addToolOutput is still needed to satisfy the SDK's internal state
    // (prevents "Tool result is missing" errors on follow-up messages),
    // but without sendAutomaticallyWhen the SDK won't re-send to the LLM.
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

  // Reset isJobSearch when streaming finishes
  useEffect(() => {
    if (!isStreaming) setIsJobSearch(false)
  }, [isStreaming])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    setIsJobSearch(isJobSearchMessage(input))
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
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
            <p className="font-semibold text-destructive mb-0.5">Something went wrong</p>
            <p className="text-muted-foreground leading-relaxed">{error.message}</p>
          </div>
        )}
        {messages.map((msg) => {
          // Suppress short "Done!" confirmation messages after a job batch —
          // the Kanban board already shows the result visually.
          if (msg.role === "assistant") {
            const text = getMessageText(msg.parts as any).trim()
            if (text.length > 0 && text.length < 80 && /done|added|board/i.test(text)) {
              return null
            }
          }
          return <MessageBubble key={msg.id} message={msg} />
        })}
        {isStreaming &&
          (() => {
            const last = messages[messages.length - 1]
            const lastIsAssistantWithText =
              last?.role === "assistant" && getMessageText(last.parts as any).trim().length > 0
            if (lastIsAssistantWithText) return null
            // Only show the progress bar for job search requests; regular
            // chat messages get a simple pulsing dots bubble instead.
            if (isJobSearch) return <ProgressIndicator />
            return (
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted border border-border">
                  <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )
          })()}
        <div ref={bottomRef} />
      </div>

      {/* Sticky input & Preferences */}
      <div className="px-3 py-3 border-t border-border shrink-0 flex flex-col gap-3 bg-card">
        {/* Search Preferences */}
        <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
            <input 
              type="checkbox" 
              className="rounded border-border bg-background"
              checked={isRemote}
              onChange={(e) => setIsRemote(e.target.checked)}
              disabled={isStreaming}
            />
            Remote Only
          </label>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2 flex-1">
            <span className="shrink-0">Location:</span>
            <input
              type="text"
              placeholder="e.g. Sri Lanka, Global..."
              className="bg-transparent border-none outline-none flex-1 text-foreground placeholder:text-muted-foreground/50 focus:ring-0"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isStreaming}
            />
          </div>
        </div>

        {/* Chat Input Row */}
        <div className="flex gap-2">
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
    </div>
  )
}
