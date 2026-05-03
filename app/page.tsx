"use client"

import { useState, useEffect } from "react"
import { ResumePanel, RESUME_STORAGE_KEY } from "@/components/resume-panel"
import { AgentChat, type AddToKanbanArgs } from "@/components/agent-chat"
import { KanbanBoard, type JobCard, STORAGE_KEY, getInitialJobs } from "@/components/kanban-board"
import { BrainCircuit } from "lucide-react"

export default function Page() {
  // Lift Kanban + Resume state to the page level so AgentChat can use them
  const [jobs, setJobs] = useState<JobCard[]>([])
  const [resume, setResume] = useState("")
  const [mounted, setMounted] = useState(false)
  // Initialize jobs and resume from localStorage after mount
  useEffect(() => {
    setJobs(getInitialJobs())
    if (typeof window !== "undefined") {
      const storedResume = localStorage.getItem(RESUME_STORAGE_KEY) || ""
      setResume(storedResume)
    }
    setMounted(true)
  }, [])

  // Handle add_to_kanban tool calls from the AI agent
  const handleAddJob = (args: AddToKanbanArgs) => {
    const newJob: JobCard = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: args.title,
      company: args.company,
      matchPercent: args.matchPercentage,
      missingSkills: args.missingSkills,
      column: "discovered" as const,
      link: args.link,
      description: args.description ?? "",
    }
    setJobs((prev) => [newJob, ...prev])
  }

  // Persist to localStorage whenever jobs change
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
    } catch {
      // ignore
    }
  }, [jobs, mounted])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Top Nav */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-card">
        <BrainCircuit className="w-5 h-5 text-primary" />
        <span className="text-sm font-bold tracking-tight text-foreground">
          JobPilot
        </span>
        <span className="text-[10px] font-mono bg-primary/20 border border-primary/30 text-primary px-2 py-0.5 rounded-full">
          AI Job Agent
        </span>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-chart-2 inline-block animate-pulse" />
          Agent active
        </div>
      </header>

      {/* Main two-column grid */}
      <main className="flex-1 grid grid-cols-[35%_65%] gap-0 overflow-hidden min-h-0">
        {/* Left Column: Resume + Agent Chat */}
        <section className="flex flex-col gap-3 p-4 border-r border-border overflow-hidden min-h-0">
          <ResumePanel resume={resume} setResume={setResume} />
          <AgentChat onAddJob={handleAddJob} resume={resume} />
        </section>

        {/* Right Column: Kanban */}
        <section className="flex flex-col gap-3 p-4 overflow-hidden min-h-0">
          <KanbanBoard jobs={jobs} setJobs={setJobs} />
        </section>
      </main>
    </div>
  )
}
