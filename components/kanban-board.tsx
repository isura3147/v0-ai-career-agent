"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Layers3,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export type KanbanColumn = "discovered" | "applied"

export type JobCard = {
  id: string
  title: string
  company: string
  matchPercent: number
  missingSkills: string[]
  column: KanbanColumn
  link: string
  description: string
}

// --------------------------------------------------------------------------
// Default seed data
// --------------------------------------------------------------------------
const DEFAULT_JOBS: JobCard[] = [
  {
    id: "job-1",
    title: "Senior Frontend Engineer",
    company: "Vercel",
    matchPercent: 88,
    missingSkills: ["GraphQL", "Rust"],
    column: "discovered",
    link: "https://vercel.com/careers",
    description:
      "Build the future of the web at Vercel. Work on Next.js, the Vercel platform, and tools used by millions of developers worldwide.",
  },
  {
    id: "job-3",
    title: "Frontend Architect",
    company: "Figma",
    matchPercent: 92,
    missingSkills: ["WebAssembly"],
    column: "applied",
    link: "https://figma.com/careers",
    description:
      "Lead the architecture of Figma's web client. You will work on rendering performance, real-time collaboration, and developer tooling.",
  },
]

const COLUMNS: { id: KanbanColumn; label: string; icon: React.ReactNode }[] = [
  { id: "discovered", label: "Discovered", icon: <Layers3 className="w-4 h-4" /> },
  { id: "applied", label: "Applied", icon: <CheckCircle2 className="w-4 h-4" /> },
]

const COLUMN_ORDER: KanbanColumn[] = ["discovered", "applied"]

function matchBadgeClass(pct: number) {
  if (pct >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800"
  if (pct >= 70) return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800"
  return "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800"
}

// --------------------------------------------------------------------------
// Job Card
// --------------------------------------------------------------------------
function JobCardItem({
  job,
  onMove,
  onRemove,
}: {
  job: JobCard
  onMove: (id: string, direction: "prev" | "next") => void
  onRemove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const currentIdx = COLUMN_ORDER.indexOf(job.column)
  const canMovePrev = currentIdx > 0
  const canMoveNext = currentIdx < COLUMN_ORDER.length - 1

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-150">

      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-base font-semibold text-foreground leading-snug">
            {job.title}
          </span>
          <span className="text-sm text-muted-foreground">{job.company}</span>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-full border font-mono",
              matchBadgeClass(job.matchPercent)
            )}
          >
            {job.matchPercent}% match
          </span>
          <button
            type="button"
            onClick={() => onRemove(job.id)}
            className="text-muted-foreground/50 hover:text-destructive transition-colors"
            aria-label="Remove job"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Always-visible posting link */}
      {job.link && (
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-2 w-fit"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          View job posting
        </a>
      )}

      {/* Missing skills */}
      {job.missingSkills.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Skills to develop
          </span>
          <div className="flex flex-wrap gap-1.5">
            {job.missingSkills.map((skill) => (
              <span
                key={skill}
                className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description toggle */}
      {job.description && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-fit select-none"
            aria-expanded={expanded}
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
            {expanded ? "Hide description" : "Show description"}
          </button>
          {expanded && (
            <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-2">
              {job.description}
            </p>
          )}
        </div>
      )}

      {/* Move buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1"
          disabled={!canMovePrev}
          onClick={() => onMove(job.id, "prev")}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1"
          disabled={!canMoveNext}
          onClick={() => onMove(job.id, "next")}
        >
          Move to Applied
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Column
// --------------------------------------------------------------------------
function KanbanColumnSection({
  col,
  jobs,
  onMove,
  onRemove,
}: {
  col: (typeof COLUMNS)[0]
  jobs: JobCard[]
  onMove: (id: string, direction: "prev" | "next") => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Column header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <span className="text-muted-foreground">{col.icon}</span>
        <span className="text-sm font-semibold text-foreground">{col.label}</span>
        <span className="ml-auto text-xs font-mono bg-muted border border-border rounded-full px-2 py-0.5 text-muted-foreground">
          {jobs.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 py-10 flex flex-col items-center gap-2">
            <span className="text-sm text-muted-foreground">No jobs here yet</span>
            <span className="text-xs text-muted-foreground/60">Ask the agent to search for roles</span>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCardItem
              key={job.id}
              job={job}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Kanban Board
// --------------------------------------------------------------------------
export const STORAGE_KEY = "career-strategist-kanban"

export function getInitialJobs(): JobCard[] {
  if (typeof window === "undefined") return DEFAULT_JOBS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_JOBS
    const parsed = JSON.parse(stored) as JobCard[]
    return parsed
      .filter((job) => job.column === "discovered" || job.column === "applied")
      .map((job) => ({
        ...job,
        link: job.link ?? "",
        description: job.description ?? "",
      }))
  } catch {
    return DEFAULT_JOBS
  }
}

interface KanbanBoardProps {
  jobs: JobCard[]
  setJobs: React.Dispatch<React.SetStateAction<JobCard[]>>
}

export function KanbanBoard({ jobs, setJobs }: KanbanBoardProps) {
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
    } catch {
      // ignore
    }
  }, [jobs])

  const handleMove = (id: string, direction: "prev" | "next") => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== id) return job
        const currentIdx = COLUMN_ORDER.indexOf(job.column)
        const nextIdx = direction === "next" ? currentIdx + 1 : currentIdx - 1
        if (nextIdx < 0 || nextIdx >= COLUMN_ORDER.length) return job
        return { ...job, column: COLUMN_ORDER[nextIdx] }
      })
    )
  }

  const handleRemove = (id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id))
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 flex-1 min-h-0 shadow-sm">
      {/* Board header */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Briefcase className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Job Pipeline</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {jobs.length} role{jobs.length !== 1 ? "s" : ""} tracked
        </span>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-5 overflow-y-auto min-h-0 pb-1">
        {COLUMNS.map((col) => (
          <KanbanColumnSection
            key={col.id}
            col={col}
            jobs={jobs.filter((j) => j.column === col.id)}
            onMove={handleMove}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  )
}
