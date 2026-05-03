"use client"

import { TrendingUp } from "lucide-react"

type SkillGap = {
  skill: string
  myLevel: number
  required: number
}

// Replace this mock data with real data from your AI tool's analysis
const SKILL_GAPS: SkillGap[] = [
  { skill: "React", myLevel: 85, required: 90 },
  { skill: "TypeScript", myLevel: 70, required: 88 },
  { skill: "GraphQL", myLevel: 30, required: 75 },
  { skill: "Docker", myLevel: 25, required: 60 },
  { skill: "Node.js", myLevel: 65, required: 70 },
]

function SkillBar({ item }: { item: SkillGap }) {
  const gap = item.required - item.myLevel
  const gapColor =
    gap > 30
      ? "text-chart-5"
      : gap > 10
        ? "text-chart-3"
        : "text-chart-2"

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{item.skill}</span>
        <span className={`text-xs font-mono ${gapColor}`}>
          {gap > 0 ? `−${gap}%` : "✓ Met"}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        {/* Required level (background bar) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-border"
          style={{ width: `${item.required}%` }}
        />
        {/* My level */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: `${item.myLevel}%`,
            background:
              gap > 30
                ? "oklch(0.65 0.24 16)"
                : gap > 10
                  ? "oklch(0.75 0.18 70)"
                  : "oklch(0.7 0.17 162)",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>Mine: {item.myLevel}%</span>
        <span>Req: {item.required}%</span>
      </div>
    </div>
  )
}

export function SkillGapWidget() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground tracking-wide">Skill Gap Analysis</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Mine
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-border inline-block" /> Required
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {SKILL_GAPS.map((item) => (
          <SkillBar key={item.skill} item={item} />
        ))}
      </div>
    </div>
  )
}
