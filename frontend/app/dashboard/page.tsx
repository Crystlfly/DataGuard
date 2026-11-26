"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Database, Gauge, ListChecks, SlidersHorizontal, Wrench } from "lucide-react"

import { FailedChecksChart } from "@/components/charts/failed-checks-chart"
import { QualityTrendChart } from "@/components/charts/quality-trend-chart"
import { SeverityDistributionChart } from "@/components/charts/severity-distribution-chart"
import { ScheduledChecksCard } from "@/components/dashboard/scheduled-checks-card"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { SeverityBadge } from "@/components/ui-custom/severity-badge"
import { StatusBadge } from "@/components/ui-custom/status-badge"
import { EmptyState } from "@/components/ui-custom/empty-state"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber, formatPercent } from "@/lib/formatters"
import type { CheckResult, RunSummary } from "@/lib/types"

function countBy<T>(rows: T[], getter: (row: T) => string | undefined) {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const key = getter(row) || "Unknown"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
}

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [latestRun, setLatestRun] = useState<RunSummary | null>(null)
  const [results, setResults] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [lastRefreshed, setLastRefreshed] = useState("")

  async function loadDashboard() {
    setLoading(true)
    setMessage("")
    try {
      const [runRows, latest] = await Promise.all([
        api.runs(),
        api.latestRun().catch(() => null),
      ])
      setRuns(runRows)
      setLatestRun(latest)
      setResults(latest?.run_id ? await api.results(latest.run_id).catch(() => []) : [])
      setLastRefreshed(formatDateTime(new Date()))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load dashboard data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const datasets = new Set(results.map((row) => row.dataset_name).filter(Boolean))
  const failedResults = results.filter((row) => row.status === "FAIL")
  const criticalResults = results.filter((row) => row.severity === "CRITICAL")
  const totalChecks = latestRun?.total_checks ?? results.length
  const failedChecksCount = latestRun?.failed_checks ?? failedResults.length
  const passedChecksCount = Math.max(0, totalChecks - failedChecksCount)
  const passRate = totalChecks ? (passedChecksCount / totalChecks) * 100 : 100

  const trendData = [...runs]
    .reverse()
    .map((run) => ({ run_id: run.run_id, quality_score: Number(run.quality_score ?? 0) }))

  const failedByDataset = useMemo(() => {
    const counts = new Map<string, number>()
    failedResults.forEach((row) => {
      const dataset = row.dataset_name ?? "Unknown"
      counts.set(dataset, (counts.get(dataset) ?? 0) + 1)
    })
    return Array.from(counts.entries()).map(([dataset, failed]) => ({ dataset, failed }))
  }, [failedResults])

  const degradedDatasets = failedByDataset.slice(0, 5)
  const failuresBySeverity = countBy(failedResults, (row) => row.severity)
  const failuresByCheckType = countBy(failedResults, (row) => row.check_type || "other")

  async function runChecks() {
    setMessage("Running checks...")
    try {
      const response = await api.runChecks()
      setMessage(response.success ? "Checks completed successfully." : "Checks completed with errors.")
      await loadDashboard()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to run checks.")
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Command Center"
        title="Executive Dashboard"
        subtitle="Management-ready view of data quality score, pass rates, and datasets requiring action."
        onRefresh={loadDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/setup">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
              >
                <Database className="size-3.5" />
                Connect DB
              </Button>
            </Link>
            <Link href="/rules">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
              >
                <SlidersHorizontal className="size-3.5" />
                Quality Rules
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={runChecks}
              className="h-7 px-2.5 text-xs bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] transition"
            >
              Run Checks Now
            </Button>
          </div>
        }
      />

      {message ? (
        <Card className="rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]">
          <CardContent className="p-3 text-xs font-medium">{message}</CardContent>
        </Card>
      ) : null}

      <ScheduledChecksCard onRunTriggered={loadDashboard} />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <EnterpriseMetricCard
          title="Quality Score"
          value={loading ? "..." : formatPercent(latestRun?.quality_score, 2)}
          description="Latest weighted score"
          icon={Gauge}
          tone="blue"
        />
        <EnterpriseMetricCard
          title="Pass Rate"
          value={loading ? "..." : formatPercent(passRate, 1)}
          description={`${passedChecksCount} of ${totalChecks} checks passing`}
          icon={CheckCircle2}
          tone="green"
        />
        <EnterpriseMetricCard
          title="Failed Checks"
          value={failedResults.length}
          description="Requires remediation"
          icon={Wrench}
          tone="amber"
        />
        <EnterpriseMetricCard
          title="Critical Issues"
          value={criticalResults.length}
          description="Highest priority"
          icon={AlertTriangle}
          tone="red"
        />
        <EnterpriseMetricCard
          title="Datasets Monitored"
          value={datasets.size}
          description="In latest run"
          icon={Database}
          tone="slate"
        />
        <EnterpriseMetricCard
          title="Latest Run Status"
          value={latestRun?.overall_status ?? "-"}
          description={latestRun?.run_time ? formatDateTime(latestRun.run_time) : "No run"}
          icon={ListChecks}
          tone={latestRun?.overall_status === "PASS" ? "green" : "red"}
        />
      </div>

      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-white">Executive Summary</CardTitle>
          <CardDescription className="text-zinc-400">Last refreshed {lastRefreshed || "not yet"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-xs font-medium text-zinc-400">Latest Run</div>
            <div className="mt-1 text-base font-semibold text-white">#{latestRun?.run_id ?? "-"}</div>
            <div className="mt-1.5"><StatusBadge status={latestRun?.overall_status} /></div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-xs font-medium text-zinc-400">Check Volume</div>
            <div className="mt-1 text-base font-semibold text-white">{formatNumber(latestRun?.total_checks ?? 0)}</div>
            <p className="mt-0.5 text-xs text-zinc-400">{formatNumber(latestRun?.failed_checks ?? 0)} failed checks</p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-xs font-medium text-zinc-400">Operational Posture</div>
            <div className="mt-1 text-base font-semibold text-white">
              {failedResults.length ? "Action Required" : "Clean & Stable"}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              {failedResults.length} defects in remediation checklist
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3.5 xl:grid-cols-2">
        <QualityTrendChart data={trendData} />
        <FailedChecksChart data={failedByDataset} />
        <SeverityDistributionChart
          data={failuresBySeverity}
          title="Defects by Severity"
          description="Failed check breakdown by urgency."
        />
        <SeverityDistributionChart
          data={failuresByCheckType}
          title="Defects by Check Type"
          description="Failed checks grouped by rule type."
        />
      </div>

      <div className="grid gap-3.5 xl:grid-cols-2">
        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Recently Degraded Datasets</CardTitle>
              <CardDescription className="text-zinc-400">Datasets with failed checks in the latest run.</CardDescription>
            </div>
            <Link href="/remediation">
              <Button variant="ghost" size="sm" className="text-xs text-[#B3FF4C] hover:bg-white/[0.04]">
                Remediate Issues &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {degradedDatasets.length ? degradedDatasets.map((row) => (
              <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition" key={row.dataset}>
                <span className="text-xs font-medium text-white">{row.dataset}</span>
                <span className="text-xs font-semibold text-rose-400">{row.failed} failures</span>
              </div>
            )) : <EmptyState title="No degraded datasets" description="The latest run has no dataset-level failures." />}
          </CardContent>
        </Card>

        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Critical Issues Requiring Action</CardTitle>
              <CardDescription className="text-zinc-400">Highest severity quality failures.</CardDescription>
            </div>
            <Link href="/remediation">
              <Button variant="ghost" size="sm" className="text-xs text-rose-400 hover:bg-white/[0.04]">
                Open Checklist &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalResults.slice(0, 5).map((row, index) => (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition" key={`${row.id}-${index}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white truncate">{row.dataset_name}</span>
                  <SeverityBadge severity={row.severity} />
                </div>
                <p className="mt-0.5 text-[0.72rem] text-zinc-400">{row.check_type} on {row.column_name ?? row.column ?? "table"}</p>
              </div>
            ))}
            {!criticalResults.length ? <EmptyState title="No critical issues" description="Critical severity failures will appear here." /> : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
