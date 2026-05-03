import { ResumePanel } from "@/components/resume-panel"
import { AgentChat } from "@/components/agent-chat"
import { SkillGapWidget } from "@/components/skill-gap-widget"
import { KanbanBoard } from "@/components/kanban-board"
import { BrainCircuit } from "lucide-react"

export default function Page() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Top Nav */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-card">
        <BrainCircuit className="w-5 h-5 text-primary" />
        <span className="text-sm font-bold tracking-tight text-foreground">
          AI Career Strategist
        </span>
        <span className="text-[10px] font-mono bg-primary/10 border border-primary/25 text-primary px-2 py-0.5 rounded-full">
          BETA
        </span>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-chart-2 inline-block animate-pulse" />
          Agent active
        </div>
      </header>

      {/* Main two-column grid */}
      <main className="flex-1 grid grid-cols-[35%_65%] gap-0 overflow-hidden min-h-0">
        {/* ── Left Column: Resume + Agent Chat ── */}
        <section className="flex flex-col gap-3 p-4 border-r border-border overflow-hidden min-h-0">
          <ResumePanel />
          <AgentChat />
        </section>

        {/* ── Right Column: Skill Gap + Kanban ── */}
        <section className="flex flex-col gap-3 p-4 overflow-hidden min-h-0">
          <SkillGapWidget />
          <KanbanBoard />
        </section>
      </main>
    </div>
  )
}
