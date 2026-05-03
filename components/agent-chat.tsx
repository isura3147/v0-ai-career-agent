"use client"

import { useRef, useState } from "react"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// --------------------------------------------------------------------------
// Types — designed to mirror Vercel AI SDK's `useChat` message shape so you
// can swap the mock data array with real `messages` from useChat() later.
// --------------------------------------------------------------------------
type ToolInvocation = {
  toolName: string
  state: "loading" | "done"
}

type Message = {
  id: string
  role: "user" | "assistant"
  content?: string
  toolInvocations?: ToolInvocation[]
}

// --------------------------------------------------------------------------
// Mock messages — replace this array with the real `messages` from useChat()
// --------------------------------------------------------------------------
const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Find me senior frontend engineer roles that match my resume and add the best ones to the kanban.",
  },
  {
    id: "2",
    role: "assistant",
    content: "Sure! I&apos;ll search the web for matching roles and analyze them against your skill set. Give me a moment…",
  },
  {
    id: "3",
    role: "assistant",
    toolInvocations: [
      { toolName: "brave_web_search", state: "done" },
      { toolName: "add_to_kanban", state: "done" },
    ],
  },
  {
    id: "4",
    role: "assistant",
    content:
      "Done! I found 3 strong matches and added them to your Kanban board under **Discovered**. Your biggest skill gaps are GraphQL and Docker — I recommend focusing on those next.",
  },
]

// --------------------------------------------------------------------------
// Tool Invocation Pill
// --------------------------------------------------------------------------
function ToolPill({ tool }: { tool: ToolInvocation }) {
  const icons: Record<string, string> = {
    brave_web_search: "🔍",
    add_to_kanban: "✨",
    analyze_skills: "🧠",
    fetch_job_details: "📄",
  }
  const icon = icons[tool.toolName] ?? "⚙️"
  const isLoading = tool.state === "loading"

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border w-fit text-xs font-mono text-muted-foreground">
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin text-primary" />
      ) : (
        <span className="text-[11px]">{icon}</span>
      )}
      <span className={cn(isLoading ? "text-primary" : "text-muted-foreground")}>
        {isLoading ? `Calling ${tool.toolName}…` : `${tool.toolName} executed`}
      </span>
      {!isLoading && (
        <span className="w-1.5 h-1.5 rounded-full bg-chart-2 inline-block" />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Message Bubble
// --------------------------------------------------------------------------
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  if (message.toolInvocations) {
    return (
      <div className="flex flex-col gap-2 pl-8">
        {message.toolInvocations.map((tool, i) => (
          <ToolPill key={i} tool={tool} />
        ))}
      </div>
    )
  }

  return (
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
          __html: (message.content ?? "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
        }}
      />
    </div>
  )
}

// --------------------------------------------------------------------------
// Agent Chat Panel — swap INITIAL_MESSAGES + input handler with useChat()
// --------------------------------------------------------------------------
export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  // Replace this handler with `handleSubmit` from useChat()
  const handleSend = () => {
    if (!input.trim()) return
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input }
    const thinkingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      toolInvocations: [{ toolName: "brave_web_search", state: "loading" }],
    }
    setMessages((prev) => [...prev, userMsg, thinkingMsg])
    setInput("")
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingMsg.id
            ? { ...m, toolInvocations: [{ toolName: "brave_web_search", state: "done" }] }
            : m
        )
      )
    }, 2000)
  }

  return (
    <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-chart-2 animate-pulse" />
        <span className="text-sm font-semibold text-foreground tracking-wide">AI Career Agent</span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded-full border border-border">
          online
        </span>
      </div>

      {/* Scrollable messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Sticky input */}
      <div className="px-3 py-3 border-t border-border shrink-0 flex gap-2">
        {/* Replace value/onChange/onKeyDown with `input`, `handleInputChange`, and `handleSubmit` from useChat() */}
        <Input
          placeholder="Ask the agent to find jobs, analyze gaps…"
          className="flex-1 bg-input border-border text-foreground text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button
          size="icon"
          onClick={handleSend}
          className="shrink-0 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
