"use client"

import { useState } from "react"
import { FileText, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function ResumePanel() {
  const [resume, setResume] = useState("")
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("career-strategist-resume", resume)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground tracking-wide uppercase">Resume</span>
      </div>
      <Textarea
        placeholder="Paste your resume text here..."
        className="min-h-[160px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground text-sm leading-relaxed focus-visible:ring-primary"
        value={resume}
        onChange={(e) => setResume(e.target.value)}
      />
      <Button
        onClick={handleSave}
        size="sm"
        className="self-end bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <Save className="w-4 h-4 mr-2" />
        {saved ? "Saved!" : "Save Resume"}
      </Button>
    </div>
  )
}
