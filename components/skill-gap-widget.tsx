"use client"

import { useMemo } from "react"
import { TrendingUp, AlertCircle } from "lucide-react"
import type { JobCard } from "@/components/kanban-board"

type SkillStat = {
  skill: string
  jobsRequiring: number
  totalJobs: number
}

interface SkillGapWidgetProps {
  jobs: JobCard[]
}

// --------------------------------------------------------------------------
// Aggregate missing skills across the whole job pipeline.
// A skill that's "missing" in many jobs => high-priority gap to close.
// --------------------------------------------------------------------------
function computeSkillStats(jobs: JobCard[]): {
  topGaps: SkillStat[]
  averageMatch: number
  totalJobs: number
} {
  if (jobs.length === 0) {
    return { topGaps: [], averageMatch: 0, totalJobs: 0 }
  }

  const counts = new Map<string, number>()
  for (const job of jobs) {
    for (const raw of job.missingSkills ?? []) {
      const skill = raw.trim()
      if (!skill) continue
      // Normalize casing so "react" and "React" don't double-count
      const key = skill.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  // Pretty-print the most common casing seen in the data
  const displayName = new Map<string, string>()
  for (const job of jobs) {
    for (const raw of job.missingSkills ?? []) {
      const key = raw.trim().toLowerCase()
      if (!displayName.has(key)) {
        displayName.set(key, raw.trim())
      }
    }
  }

  const topGaps: SkillStat[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, count]) => ({
      skill: displayName.get(key) ?? key,
      jobsRequiring: count,
      totalJobs: jobs.length,
    }))

  const averageMatch =
    Math.round(jobs.reduce((sum, j) => sum + (j.matchPercent ?? 0), 0) / jobs.length)

  return { topGaps, averageMatch, totalJobs: jobs.length }
}

function severityColor(percent: number) {
  if (percent >= 66) return "bg-chart-5"
  if (percent >= 33) return "bg-chart-3"
  return "bg-chart-2"
}

function severityTextColor(percent: number) {
  if (percent >= 66) return "text-chart-5"
  if (percent >= 33) return "text-chart-3"
  return "text-chart-2"
}

function SkillBar({ item }: { item: SkillStat }) {
  // Demand = % of tracked jobs that require this skill
  const demand = Math.round((item.jobsRequiring / item.totalJobs) * 100)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground truncate">{item.skill}</span>
        <span className={`text-xs font-mono shrink-0 ${severityTextColor(demand)}`}>
          {item.jobsRequiring}/{item.totalJobs}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${severityColor(demand)}`}
          style={{ width: `${Math.max(demand, 4)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>Demand</span>
        <span>{demand}%</span>
      </div>
    </div>
  )
}

export function SkillGapWidget({ jobs }: SkillGapWidgetProps) {
  const { topGaps, averageMatch, totalJobs } = useMemo(() => computeSkillStats(jobs), [jobs])

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground tracking-wide">
            Skill Gap Analysis
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-chart-2 inline-block" /> Low
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-chart-3 inline-block" /> Medium
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-chart-5 inline-block" /> High
          </span>
        </div>
      </div>

      {/* Summary chips */}
      {totalJobs > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-secondary border border-border text-muted-foreground">
            {totalJobs} job{totalJobs !== 1 ? "s" : ""} analyzed
          </span>
          <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-secondary border border-border text-muted-foreground">
            avg match{" "}
            <span className="text-foreground font-semibold">{averageMatch}%</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-secondary border border-border text-muted-foreground">
            {topGaps.length} unique gap{topGaps.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Empty state */}
      {totalJobs === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <AlertCircle className="w-3.5 h-3.5" />
          Ask the agent to find jobs — your skill gaps will appear here.
        </div>
      )}

      {totalJobs > 0 && topGaps.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-chart-2 py-2">
          <TrendingUp className="w-3.5 h-3.5" />
          No skill gaps detected across your tracked jobs. Strong alignment!
        </div>
      )}

      {/* Skill bars */}
      {topGaps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
          {topGaps.map((item) => (
            <SkillBar key={item.skill} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
