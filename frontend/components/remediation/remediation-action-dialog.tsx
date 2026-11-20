"use client"

import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck, Wrench } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { JobStatusBadge } from "@/components/remediation/job-status-badge"
import { StatusBadge } from "@/components/ui-custom/status-badge"
import { formatDateTime } from "@/lib/formatters"
import type { CleaningJob, ProposedCleaningChange } from "@/lib/types"

export type RemediationAction = "approve" | "execute" | "rollback"

type RemediationActionDialogProps = {
  job?: CleaningJob
  action?: RemediationAction
  open: boolean
  saving?: boolean
  error?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const actionCopy: Record<RemediationAction, { title: string; description: string; confirm: string; tone: string }> = {
  approve: {
    title: "Approve Cleaning Job",
    description: "Review the proposed before/after values before releasing this job for execution.",
    confirm: "Approve Job",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  execute: {
    title: "Execute Cleaning Job",
    description: "This will apply the approved remediation action to the configured source table.",
    confirm: "Execute Job",
    tone: "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]",
  },
  rollback: {
    title: "Rollback Cleaning Job",
    description: "This will restore values using the recorded change history for this executed job.",
    confirm: "Rollback Job",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
}

export function RemediationActionDialog({
  job,
  action = "approve",
  open,
  saving = false,
  error,
  onOpenChange,
  onConfirm,
}: RemediationActionDialogProps) {
  const copy = actionCopy[action]
  const proposed = job?.proposed_changes ?? []
  const changes = job?.change_log ?? []
  const rowsToShow = action === "rollback" ? changes : proposed
  const Icon = action === "rollback" ? RotateCcw : action === "execute" ? Wrench : ShieldCheck

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-5">
          <div className="flex items-start gap-3">
            <div className={`flex size-9 items-center justify-center rounded-md border ${copy.tone}`}>
              <Icon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-white">{copy.title}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-zinc-400">{copy.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5 p-5">
          {job ? (
            <div className="rounded-md border border-white/[0.08] bg-[#141414] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Cleaning Job #{job.id}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-zinc-400">
                    {job.dataset_name ?? "Dataset"} / {job.cleaning_action ?? "Cleaning action"}
                  </div>
                </div>
                <JobStatusBadge status={job.status} />
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <InfoTile label="Target" value={`${job.target_table ?? "table"}.${job.target_column ?? "column"}`} />
                <InfoTile label="Requested By" value={job.requested_by || "Unknown"} />
                <InfoTile label="Created" value={formatDateTime(job.created_at)} />
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">
                  {action === "rollback" ? "Recorded Change History" : "Proposed Before/After Changes"}
                </div>
                <div className="text-sm text-zinc-400">
                  {action === "rollback"
                    ? "Rollback uses these recorded old values."
                    : "Admins should confirm these values before approval or execution."}
                </div>
              </div>
              <StatusBadge status={`${rowsToShow.length} row(s)`} />
            </div>
            {!rowsToShow.length ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                No row-level change preview is recorded for this job. Review the target table, column, and action carefully.
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-white/[0.08] bg-black/40 p-3">
                {rowsToShow.map((change, index) => (
                  <ChangeRow key={`${change.row_identifier}-${index}`} change={change} />
                ))}
              </div>
            )}
          </div>

          {action === "execute" ? (
            <div className="flex items-start gap-2 rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 p-3 text-xs text-[#B3FF4C]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              Execution writes source changes and records before/after values in change history.
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={saving || !job}>
            {saving ? "Working..." : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 truncate font-medium text-white" title={value}>
        {value}
      </div>
    </div>
  )
}

function ChangeRow({ change }: { change: ProposedCleaningChange }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-zinc-300">
          {change.table_name}.{change.column_name}
        </div>
        <div className="text-xs text-zinc-400">{change.row_identifier}</div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <span className="truncate rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-zinc-300" title={String(change.old_value ?? "")}>
          {String(change.old_value ?? "NULL")}
        </span>
        <span className="self-center text-center text-zinc-400">to</span>
        <span className="truncate rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-medium text-white" title={String(change.new_value ?? "")}>
          {String(change.new_value ?? "NULL")}
        </span>
      </div>
    </div>
  )
}
