"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Building2,
  Layers3,
  ChevronDown,
  ExternalLink,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export type KanbanColumn = "discovered" | "best_matches" | "applied"

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
// Default seed data — will be overwritten by the AI agent's add_to_kanban tool
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
    id: "job-2",
    title: "Staff React Developer",
    company: "Linear",
    matchPercent: 74,
    missingSkills: ["Docker", "GraphQL", "Go"],
    column: "best_matches",
    link: "https://linear.app/careers",
    description:
      "Help us build the issue tracker that engineering teams love. You'll work on complex React applications with a focus on performance and design.",
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
      "Lead the architecture of Figma's web client. You'll work on rendering performance, real-time collaboration, and developer tooling.",
  },
]

const COLUMNS: { id: KanbanColumn; label: string; icon: React.ReactNode }[] = [
  { id: "discovered", label: "Discovered", icon: <Layers3 className="w-3.5 h-3.5" /> },
  { id: "best_matches", label: "Best Matches", icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: "applied", label: "Applied", icon: <Building2 className="w-3.5 h-3.5" /> },
]

const COLUMN_ORDER: KanbanColumn[] = ["discovered", "best_matches", "applied"]

function matchColor(pct: number) {
  if (pct >= 85) return "text-chart-2 bg-chart-2/10 border-chart-2/30"
  if (pct >= 70) return "text-chart-3 bg-chart-3/10 border-chart-3/30"
  return "text-chart-5 bg-chart-5/10 border-chart-5/30"
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
    <div className="rounded-lg border border-border bg-secondary/40 p-3 flex flex-col gap-2.5 hover:border-primary/40 hover:bg-secondary/70 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-col gap-0.5 min-w-0 text-left flex-1 hover:opacity-90"
          aria-expanded={expanded}
        >
          <span className="text-sm font-semibold text-foreground leading-tight truncate">
            {job.title}
          </span>
          <span className="text-xs text-muted-foreground truncate">{job.company}</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full border font-mono",
              matchColor(job.matchPercent)
            )}
          >
            {job.matchPercent}%
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {/* Missing Skills */}
      {job.missingSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.missingSkills.map((skill) => (
            <span
              key={skill}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60">
          {job.description ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {job.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">
              No description provided.
            </p>
          )}
          {job.link && (
            <a
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline w-fit"
            >
              <ExternalLink className="w-3 h-3" />
              View posting
            </a>
          )}
        </div>
      )}

      {/* Move + remove buttons */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={!canMovePrev}
          onClick={() => onMove(job.id, "prev")}
          aria-label="Move to previous column"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={!canMoveNext}
          onClick={() => onMove(job.id, "next")}
          aria-label="Move to next column"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono capitalize">
          {COLUMNS.find((c) => c.id === job.column)?.label}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 border-border bg-transparent hover:bg-destructive/20 hover:border-destructive/40 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(job.id)}
          aria-label="Remove job"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Column Header
// --------------------------------------------------------------------------
function ColumnHeader({ col, count }: { col: (typeof COLUMNS)[0]; count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {col.icon}
        <span className="text-xs font-semibold uppercase tracking-widest">{col.label}</span>
      </div>
      <span className="text-[10px] font-mono bg-secondary border border-border rounded-full px-2 py-0.5 text-muted-foreground">
        {count}
      </span>
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
    // Backfill new fields for older cached entries that may be missing them
    return parsed.map((job) => ({
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
  // Persist to localStorage whenever jobs change
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
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center gap-2 shrink-0">
        <Briefcase className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground tracking-wide">Job Pipeline</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {jobs.length} role{jobs.length !== 1 ? "s" : ""} tracked
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 overflow-y-auto min-h-0">
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => j.column === col.id)
          return (
            <div key={col.id} className="flex flex-col gap-2 min-w-0">
              <ColumnHeader col={col} count={colJobs.length} />
              <div
                className={cn(
                  "flex flex-col gap-2 min-h-[80px] rounded-lg p-2 border border-dashed",
                  colJobs.length === 0 ? "border-border/50 bg-secondary/10" : "border-transparent"
                )}
              >
                {colJobs.length === 0 ? (
                  <p className="text-center text-[11px] text-muted-foreground/50 mt-4">Empty</p>
                ) : (
                  colJobs.map((job) => (
                    <JobCardItem
                      key={job.id}
                      job={job}
                      onMove={handleMove}
                      onRemove={handleRemove}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
