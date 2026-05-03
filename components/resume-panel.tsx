"use client"

import { useState } from "react"
import { FileText, Save, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export const RESUME_STORAGE_KEY = "career-strategist-resume"

interface ResumePanelProps {
  resume: string
  setResume: (value: string) => void
}

export function ResumePanel({ resume, setResume }: ResumePanelProps) {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(RESUME_STORAGE_KEY, resume)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasResume = resume.trim().length > 0

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Resume Summary</span>
        {hasResume && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active
          </span>
        )}
      </div>

      {/* Textarea */}
      <Textarea
        placeholder="Paste a summary of your resume here — skills, experience level, tech stack, and the roles you are targeting. The agent will use this to find and score relevant jobs for you."
        className="min-h-[160px] resize-none text-sm leading-relaxed"
        value={resume}
        onChange={(e) => setResume(e.target.value)}
      />

      {/* Save button */}
      <Button
        onClick={handleSave}
        size="sm"
        className="self-end"
      >
        <Save className="w-4 h-4 mr-2" />
        {saved ? "Saved!" : "Save Resume"}
      </Button>
    </div>
  )
}
