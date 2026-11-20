"use client"

import { AlertTriangle, PlayCircle, ShieldAlert } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CleaningPreviewTable } from "@/components/remediation/cleaning-preview-table"
import { RiskBadge } from "@/components/remediation/risk-badge"
import type { CleaningPreview, CleaningSuggestion } from "@/lib/types"

type RemediationPreviewDialogProps = {
  open: boolean
  mode: "create" | "execute"
  preview?: CleaningPreview | null
  suggestion?: CleaningSuggestion
  saving?: boolean
  error?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function RemediationPreviewDialog({
  open,
  mode,
  preview,
  suggestion,
  saving = false,
  error,
  onOpenChange,
  onConfirm,
}: RemediationPreviewDialogProps) {
  const title = mode === "execute" ? "Create and Execute Cleaning Job" : "Create Cleaning Job"
  const description =
    mode === "execute"
      ? "Review the dry-run preview before creating, approving, and executing this job."
      : "Review the dry-run preview before submitting this remediation job."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]">
              {mode === "execute" ? <PlayCircle className="size-4" /> : <ShieldAlert className="size-4" />}
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-white">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-zinc-400">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5 p-5">
          <div className="rounded-md border border-white/[0.08] bg-[#141414] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-white">{preview?.summary ?? "No preview available"}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {preview?.target_table}.{preview?.target_column ?? "column"} · {preview?.total_rows_targeted ?? 0} row(s)
                </div>
              </div>
              {suggestion ? <RiskBadge risk={suggestion.risk} /> : null}
            </div>
          </div>

          {preview?.preview_rows?.length ? (
            <CleaningPreviewTable rows={preview.preview_rows} />
          ) : (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
              No row-level preview rows were returned. Review the target carefully before continuing.
            </div>
          )}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={saving || !preview}>
            {saving ? "Working..." : mode === "execute" ? "Create and Execute" : "Create Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
