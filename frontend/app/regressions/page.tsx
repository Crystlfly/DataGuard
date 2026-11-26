"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  GitCompareArrows,
  History,
  Minus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { SeverityBadge } from "@/components/ui-custom/severity-badge"
import { EmptyState } from "@/components/ui-custom/empty-state"
import { api } from "@/lib/api-client"
import { formatDateTime, formatPercent } from "@/lib/formatters"
import type { RunDiffItem, RunDiffResponse } from "@/lib/types"

function VerdictBanner({ diff }: { diff: RunDiffResponse }) {
  const delta = diff.summary_delta.quality_score_delta ?? 0
  const baseScore = diff.base_run?.quality_score ?? 0
  const targetScore = diff.target_run?.quality_score ?? 0

  const styles =
    diff.verdict === "DEGRADED"
      ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
      : diff.verdict === "IMPROVED"
      ? "border-[#B3FF4C]/35 bg-[#B3FF4C]/10 text-[#B3FF4C]"
      : "border-white/[0.1] bg-[#141414] text-zinc-200"

  return (
    <Card className={`rounded-md border ${styles}`}>
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md border border-current/25 bg-black/30 p-2">
            {diff.verdict === "DEGRADED" ? (
              <TrendingDown className="size-4 text-rose-400" />
            ) : diff.verdict === "IMPROVED" ? (
              <TrendingUp className="size-4 text-[#B3FF4C]" />
            ) : (
              <ShieldCheck className="size-4 text-zinc-300" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold tracking-tight">
                {diff.verdict === "DEGRADED"
                  ? "Quality Regression Detected"
                  : diff.verdict === "IMPROVED"
                  ? "Quality Health Improved"
                  : diff.verdict === "BASELINE_ONLY"
                  ? "Only One Run Recorded"
                  : "Quality Posture Stable"}
              </span>
              {diff.base_run && diff.target_run && (
                <span className="rounded bg-black/40 border border-white/10 px-2 py-0.5 font-mono text-xs text-zinc-200">
                  Run #{diff.base_run.run_id} ({formatPercent(baseScore, 1)}) &rarr; Run #{diff.target_run.run_id} (
                  {formatPercent(targetScore, 1)})
                </span>
              )}
            </div>
            <p className="text-xs opacity-85 mt-1">
              {diff.base_run
                ? `${diff.new_regressions.length} new regression(s), ${diff.newly_resolved.length} newly resolved issue(s), and ${diff.persistent_failures.length} persistent defect(s).`
                : "Execute at least two quality check runs to compare baseline vs target deltas."}
            </p>
          </div>
        </div>

        {diff.new_regressions.length > 0 && (
          <Link href="/remediation">
            <Button size="sm" className="bg-rose-500 text-white hover:bg-rose-600 text-xs gap-1.5 h-8">
              <Wrench className="size-3.5" />
              Remediate New Regressions
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

function DiffItemCard({
  item,
  mode,
}: {
  item: RunDiffItem
  mode: "regression" | "resolved" | "persistent"
}) {
  const delta = item.failed_rows_delta
  const borderClass =
    mode === "regression"
      ? "border-rose-500/30 bg-rose-500/[0.05]"
      : mode === "resolved"
      ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/[0.05]"
      : "border-white/[0.08] bg-[#141414]"

  return (
    <div className={`rounded-md border p-3.5 text-xs space-y-2 ${borderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono font-semibold text-white">
            {item.dataset_name}.{item.column_name || "table"}
          </span>
          <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[0.68rem] text-zinc-300">
            {item.check_type}
          </span>
          {item.rule && (
            <code className="text-[0.68rem] text-zinc-400">{item.rule}</code>
          )}
          <SeverityBadge severity={item.severity} />
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="text-zinc-400">
            {item.base_status} ({item.base_failed_rows} rows)
          </span>
          <ArrowRight className="size-3 text-zinc-500" />
          <span
            className={
              item.target_status === "FAIL" ? "font-bold text-rose-300" : "font-bold text-[#B3FF4C]"
            }
          >
            {item.target_status} ({item.target_failed_rows} rows)
          </span>
          {delta !== 0 && (
            <span
              className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${
                delta > 0
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-[#B3FF4C]/20 text-[#B3FF4C]"
              }`}
            >
              {delta > 0 ? `+${delta} worse` : `${delta} fixed`}
            </span>
          )}
        </div>
      </div>

      {item.examples && item.examples.length > 0 && (
        <div className="pt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.68rem] text-zinc-500">Failing samples:</span>
          {item.examples.map((ex, i) => (
            <span
              key={i}
              className="rounded border border-rose-500/30 bg-black/40 px-2 py-0.5 font-mono text-[0.68rem] text-rose-200"
            >
              {ex.row_identifier}: <strong className="text-white">{ex.bad_value}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RegressionsPage() {
  const [diff, setDiff] = useState<RunDiffResponse | null>(null)
  const [baseRunId, setBaseRunId] = useState<number | undefined>()
  const [targetRunId, setTargetRunId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDiff = useCallback(async (bId?: number, tId?: number) => {
    setLoading(true)
    setError("")
    try {
      const res = await api.runDiff(bId, tId)
      setDiff(res)
      if (res.base_run?.run_id !== undefined) setBaseRunId(res.base_run.run_id)
      if (res.target_run?.run_id !== undefined) setTargetRunId(res.target_run.run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load run regression diff.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDiff()
  }, [loadDiff])

  function handleSelectBase(val: string) {
    const num = Number(val)
    if (!Number.isNaN(num)) {
      setBaseRunId(num)
      loadDiff(num, targetRunId)
    }
  }

  function handleSelectTarget(val: string) {
    const num = Number(val)
    if (!Number.isNaN(num)) {
      setTargetRunId(num)
      loadDiff(baseRunId, num)
    }
  }

  function handleSwap() {
    if (baseRunId === undefined || targetRunId === undefined) return
    const nextBase = targetRunId
    const nextTarget = baseRunId
    setBaseRunId(nextBase)
    setTargetRunId(nextTarget)
    loadDiff(nextBase, nextTarget)
  }

  const scoreDelta = diff?.summary_delta.quality_score_delta ?? 0
  const scoreDeltaText = scoreDelta > 0 ? `+${scoreDelta}%` : `${scoreDelta}%`

  return (
    <AppShell>
      <PageHeader
        eyebrow="Command Center"
        title="Run-to-Run Regression Diff"
        subtitle="Compare any two quality check runs to pinpoint newly broken checks, fixed defects, and persistent issues."
        onRefresh={() => loadDiff(baseRunId, targetRunId)}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDiff(undefined, undefined)}
            className="h-7 text-xs border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] gap-1.5"
          >
            <History className="size-3.5" />
            Latest vs Previous
          </Button>
        }
      />

      {error && (
        <Card className="rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
          <CardContent className="p-3 text-xs">{error}</CardContent>
        </Card>
      )}

      {/* Run Selector Comparison Bar */}
      {diff?.has_runs && (
        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1">
                <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Baseline Run (Before)
                </label>
                <select
                  value={baseRunId ?? ""}
                  onChange={(e) => handleSelectBase(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-[#0c0c0c] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]"
                >
                  {diff.available_runs.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      Run #{r.run_id} — {formatPercent(r.quality_score, 1)} ({r.failed_checks} failed) •{" "}
                      {formatDateTime(r.run_time)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-center pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSwap}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-[#B3FF4C] hover:bg-white/[0.05]"
                  title="Swap Baseline and Target Runs"
                >
                  <ArrowLeftRight className="size-4" />
                </Button>
              </div>

              <div className="flex-1">
                <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Target Run (After)
                </label>
                <select
                  value={targetRunId ?? ""}
                  onChange={(e) => handleSelectTarget(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-[#0c0c0c] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]"
                >
                  {diff.available_runs.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      Run #{r.run_id} — {formatPercent(r.quality_score, 1)} ({r.failed_checks} failed) •{" "}
                      {formatDateTime(r.run_time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {diff && diff.has_runs ? (
        <>
          <VerdictBanner diff={diff} />

          {/* Delta KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <EnterpriseMetricCard
              title="Quality Score Delta"
              value={loading ? "..." : scoreDeltaText}
              description={
                diff.base_run
                  ? `${formatPercent(diff.base_run.quality_score, 1)} → ${formatPercent(diff.target_run?.quality_score, 1)}`
                  : "Single baseline run"
              }
              icon={scoreDelta > 0 ? ArrowUpRight : scoreDelta < 0 ? ArrowDownRight : Minus}
              tone={scoreDelta > 0 ? "green" : scoreDelta < 0 ? "red" : "slate"}
            />
            <EnterpriseMetricCard
              title="New Regressions"
              value={diff.new_regressions.length}
              description="Passed before, failing now"
              icon={AlertTriangle}
              tone={diff.new_regressions.length > 0 ? "red" : "green"}
            />
            <EnterpriseMetricCard
              title="Newly Resolved"
              value={diff.newly_resolved.length}
              description="Failed before, passing now"
              icon={CheckCircle2}
              tone="green"
            />
            <EnterpriseMetricCard
              title="Persistent Defects"
              value={diff.persistent_failures.length}
              description={`${diff.unchanged_passes} checks stayed PASS`}
              icon={GitCompareArrows}
              tone={diff.persistent_failures.length > 0 ? "amber" : "slate"}
            />
          </div>

          {/* Diff Categorized Tabs */}
          <Tabs defaultValue={diff.new_regressions.length > 0 ? "regressions" : "persistent"}>
            <TabsList className="bg-[#141414] border border-white/[0.08]">
              <TabsTrigger value="regressions" className="text-xs">
                New Regressions ({diff.new_regressions.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">
                Newly Resolved ({diff.newly_resolved.length})
              </TabsTrigger>
              <TabsTrigger value="persistent" className="text-xs">
                Persistent Defects ({diff.persistent_failures.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="regressions" className="mt-3 space-y-2.5">
              {diff.new_regressions.length > 0 ? (
                diff.new_regressions.map((item, idx) => (
                  <DiffItemCard key={`reg-${idx}`} item={item} mode="regression" />
                ))
              ) : (
                <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
                  <CardContent className="p-8">
                    <EmptyState
                      title="Zero new regressions"
                      description="No checks degraded from PASS to FAIL between these two runs."
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="resolved" className="mt-3 space-y-2.5">
              {diff.newly_resolved.length > 0 ? (
                diff.newly_resolved.map((item, idx) => (
                  <DiffItemCard key={`res-${idx}`} item={item} mode="resolved" />
                ))
              ) : (
                <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
                  <CardContent className="p-8">
                    <EmptyState
                      title="No newly resolved checks"
                      description="Fix defects in the Remediation Center and run checks again to track resolutions here."
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="persistent" className="mt-3 space-y-2.5">
              {diff.persistent_failures.length > 0 ? (
                diff.persistent_failures.map((item, idx) => (
                  <DiffItemCard key={`per-${idx}`} item={item} mode="persistent" />
                ))
              ) : (
                <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
                  <CardContent className="p-8">
                    <EmptyState
                      title="No persistent failures"
                      description="Everything passed across both selected runs."
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : !loading ? (
        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-8">
            <EmptyState
              title="No runs recorded yet"
              description="Run data quality checks from the Executive Dashboard to start tracking regressions."
            />
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  )
}
