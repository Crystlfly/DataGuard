"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Database,
  ExternalLink,
  Flame,
  Info,
  Layers,
  ListChecks,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Table2,
  Wrench,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/ui-custom/page-header"
import { SeverityBadge } from "@/components/ui-custom/severity-badge"
import { IssueStatusBadge } from "@/components/remediation/issue-status-badge"
import { IssueDetailDrawer } from "@/components/remediation/issue-detail-drawer"
import { TableXrayGrid } from "@/components/remediation/table-xray-grid"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type { CleanableIssue, CleaningSuggestion } from "@/lib/types"

type VerifyFeedback = {
  fixed: boolean
  message: string
  current_value?: string | null
}

export default function RemediationPage() {
  const [issues, setIssues] = useState<CleanableIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"checklist" | "xray">("checklist")
  const [activeTab, setActiveTab] = useState<"open" | "resolved" | "all">("open")
  const [actionMessage, setActionMessage] = useState("")
  const [actionError, setActionError] = useState("")

  // Live verification state per issue
  const [verifyingId, setVerifyingId] = useState<number | null>(null)
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [verifyFeedbacks, setVerifyFeedbacks] = useState<Record<number, VerifyFeedback>>({})

  // Full check pipeline state
  const [runningChecks, setRunningChecks] = useState(false)

  // Drawer state
  const [selectedIssue, setSelectedIssue] = useState<CleanableIssue | undefined>()
  const [suggestions, setSuggestions] = useState<CleaningSuggestion[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setActionError("")
    try {
      const latest = await api.latestRun().catch(() => null)
      const issueRows = await api.cleanableIssues(latest?.run_id)
      setIssues(issueRows)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load issues.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtered issue lists
  const openIssues = useMemo(
    () => issues.filter((i) => (i.issue_status || "OPEN").toUpperCase() === "OPEN"),
    [issues]
  )

  const resolvedIssues = useMemo(
    () => issues.filter((i) => (i.issue_status || "").toUpperCase() === "RESOLVED"),
    [issues]
  )

  const criticalCount = useMemo(
    () => openIssues.filter((i) => (i.severity || "").toUpperCase() === "CRITICAL").length,
    [openIssues]
  )

  const progressPercent = useMemo(() => {
    if (!issues.length) return 100
    return Math.round((resolvedIssues.length / issues.length) * 100)
  }, [issues.length, resolvedIssues.length])

  // Verify single issue against live database
  async function handleVerifyIssue(issueId: number) {
    setVerifyingId(issueId)
    setActionMessage("")
    setActionError("")
    try {
      const res = await api.verifyIssue(issueId)
      setVerifyFeedbacks((prev) => ({
        ...prev,
        [issueId]: {
          fixed: res.fixed,
          message: res.message,
          current_value: res.current_value,
        },
      }))

      if (res.fixed) {
        setActionMessage(`Issue #${issueId} verified and marked as RESOLVED!`)
        // Update local status so it moves immediately
        setIssues((prev) =>
          prev.map((item) =>
            item.id === issueId
              ? { ...item, issue_status: "RESOLVED", resolution_type: "MANUAL_FIX_VERIFIED" }
              : item
          )
        )
      } else {
        setActionError(`Issue #${issueId}: ${res.message}`)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Verification request failed.")
    } finally {
      setVerifyingId(null)
    }
  }

  // Verify all open issues in sequence
  async function handleVerifyAllOpen() {
    if (!openIssues.length) return
    setVerifyingAll(true)
    setActionMessage("Verifying all open issues against live database...")
    setActionError("")
    let fixedCount = 0
    let stillFailingCount = 0

    try {
      for (const issue of openIssues) {
        try {
          const res = await api.verifyIssue(Number(issue.id))
          setVerifyFeedbacks((prev) => ({
            ...prev,
            [Number(issue.id)]: {
              fixed: res.fixed,
              message: res.message,
              current_value: res.current_value,
            },
          }))
          if (res.fixed) {
            fixedCount++
          } else {
            stillFailingCount++
          }
        } catch {
          stillFailingCount++
        }
      }

      await loadData()

      if (fixedCount > 0) {
        setActionMessage(`Verified ${fixedCount} issue(s) resolved! (${stillFailingCount} still open).`)
      } else {
        setActionError(`All ${openIssues.length} open issues are still failing in your database. Please update them first.`)
      }
    } finally {
      setVerifyingAll(false)
    }
  }

  // Run the full engine pipeline
  async function handleRunChecks() {
    setRunningChecks(true)
    setActionMessage("Running quality checks against connected database...")
    setActionError("")
    try {
      const response = await api.runChecks()
      if (response.success) {
        setActionMessage("Full check run completed! Refreshing issues...")
      } else {
        setActionError("Check run completed with errors. See dashboard.")
      }
      await loadData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to run checks.")
    } finally {
      setRunningChecks(false)
    }
  }

  // Open details drawer
  async function handleOpenDrawer(issue: CleanableIssue) {
    setSelectedIssue(issue)
    setDrawerOpen(true)
    try {
      const res = await api.cleaningSuggestions(Number(issue.id))
      setSuggestions(res.suggestions)
    } catch {
      setSuggestions([])
    }
  }

  // Update status (e.g. false positive, ignore)
  async function handleStatusChange(issue: CleanableIssue, status: string) {
    try {
      await api.updateIssueStatus(Number(issue.id), { status })
      setActionMessage(`Issue #${issue.id} marked as ${status}.`)
      await loadData()
      setDrawerOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update issue status.")
    }
  }

  // Apply search query filter
  const currentList = useMemo(() => {
    let source = issues
    if (activeTab === "open") source = openIssues
    if (activeTab === "resolved") source = resolvedIssues

    if (!searchQuery.trim()) return source
    const q = searchQuery.toLowerCase()
    return source.filter(
      (item) =>
        item.dataset_name?.toLowerCase().includes(q) ||
        item.column_name?.toLowerCase().includes(q) ||
        item.reason?.toLowerCase().includes(q) ||
        item.check_type?.toLowerCase().includes(q) ||
        item.bad_value?.toLowerCase().includes(q) ||
        item.row_identifier?.toLowerCase().includes(q)
    )
  }, [issues, openIssues, resolvedIssues, activeTab, searchQuery])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Data Remediation Center"
        subtitle="Interactive checklist of data issues in your database. Update the values in your database, then tick them to verify."
        onRefresh={loadData}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyAllOpen}
              disabled={verifyingAll || !openIssues.length}
              className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            >
              {verifyingAll ? <Loader2 className="size-3.5 animate-spin text-[#B3FF4C]" /> : <CheckCircle2 className="size-3.5 text-[#B3FF4C]" />}
              {verifyingAll ? "Verifying..." : `Verify All Open (${openIssues.length})`}
            </Button>
            <Button
              size="sm"
              onClick={handleRunChecks}
              disabled={runningChecks}
              className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] transition"
            >
              {runningChecks ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
              {runningChecks ? "Running..." : "Run Checks Now"}
            </Button>
          </div>
        }
      />

      {/* Progress & Overview Card */}
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Fix Progress
                </span>
                <span className="rounded-full bg-[#B3FF4C]/10 px-2 py-0.5 text-[11px] font-bold text-[#B3FF4C]">
                  {progressPercent}% Complete
                </span>
              </div>
              <div className="mt-1 text-2xl font-bold text-white tracking-tight">
                {resolvedIssues.length} <span className="text-zinc-500 text-base font-normal">of</span> {issues.length} Issues Resolved
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Fix records directly in your database, then click the checkbox or &quot;Verify Fix&quot; to confirm.
              </p>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-center">
                <div className="text-[11px] font-medium text-zinc-400">Open to Fix</div>
                <div className="mt-0.5 text-lg font-bold text-white">{openIssues.length}</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-center">
                <div className="text-[11px] font-medium text-rose-400 flex items-center justify-center gap-1">
                  <Flame className="size-3" /> Critical
                </div>
                <div className="mt-0.5 text-lg font-bold text-rose-400">{criticalCount}</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-center">
                <div className="text-[11px] font-medium text-[#B3FF4C]">Verified Fixed</div>
                <div className="mt-0.5 text-lg font-bold text-[#B3FF4C]">{resolvedIssues.length}</div>
              </div>
            </div>
          </div>

          {/* Progress bar line */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full bg-[#B3FF4C] transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications / Feedback banner */}
      {actionMessage ? (
        <Card className="rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]">
          <CardContent className="p-3 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-[#B3FF4C]" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage("")} className="text-xs hover:underline cursor-pointer">
              Dismiss
            </button>
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <Card className="rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400">
          <CardContent className="p-3 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError("")} className="text-xs hover:underline cursor-pointer">
              Dismiss
            </button>
          </CardContent>
        </Card>
      ) : null}

      {/* View Mode Switcher: Fix Checklist vs Live Spreadsheet X-Ray */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="inline-flex rounded-md border border-white/10 bg-[#141414] p-1">
          <button
            type="button"
            onClick={() => setViewMode("checklist")}
            className={`flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              viewMode === "checklist"
                ? "bg-[#B3FF4C] text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ListChecks className="size-3.5" />
            <span>Fix Checklist ({openIssues.length} Open)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("xray")}
            className={`flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              viewMode === "xray"
                ? "bg-[#B3FF4C] text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Table2 className="size-3.5" />
            <span>Spreadsheet X-Ray (Inline Edit)</span>
          </button>
        </div>
      </div>

      {viewMode === "xray" ? (
        <TableXrayGrid onDataFixed={loadData} />
      ) : (
      /* Checklist Header, Search & Tabs */
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "open" | "resolved" | "all")}>
            <TabsList className="bg-white/[0.03] border border-white/10">
              <TabsTrigger
                value="open"
                className="data-[state=active]:bg-[#B3FF4C] data-[state=active]:text-black text-xs font-medium"
              >
                To-Do Checklist ({openIssues.length})
              </TabsTrigger>
              <TabsTrigger
                value="resolved"
                className="data-[state=active]:bg-[#B3FF4C] data-[state=active]:text-black text-xs font-medium"
              >
                Verified & Fixed ({resolvedIssues.length})
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-[#B3FF4C] data-[state=active]:text-black text-xs font-medium"
              >
                All Issues ({issues.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-3.5 text-zinc-500" />
            <Input
              type="text"
              placeholder="Filter by table, column, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs border-white/10 bg-white/[0.02] text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-[#B3FF4C]"
            />
          </div>
        </div>

        {/* The Interactive Checklist Items */}
        {loading ? (
          <div className="rounded-md border border-white/[0.08] bg-[#141414] p-12 text-center text-zinc-400">
            <Loader2 className="mx-auto size-6 animate-spin text-[#B3FF4C]" />
            <div className="mt-2 text-xs">Loading remediation checklist...</div>
          </div>
        ) : !currentList.length ? (
          <div className="rounded-md border border-white/[0.08] bg-[#141414] p-12 text-center">
            <CheckCircle2 className="mx-auto size-10 text-[#B3FF4C]/60" />
            <div className="mt-3 text-sm font-semibold text-white">
              {activeTab === "open" ? "Zero open issues! Your data is clean." : "No issues match your filter."}
            </div>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
              {activeTab === "open"
                ? "All detected data quality issues have been verified and resolved."
                : "Try adjusting your search query or selecting a different tab."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentList.map((issue) => {
              const issueId = Number(issue.id)
              const isResolved = (issue.issue_status || "").toUpperCase() === "RESOLVED"
              const isVerifying = verifyingId === issueId
              const feedback = verifyFeedbacks[issueId]

              return (
                <div
                  key={issue.id}
                  className={`group rounded-md border p-3.5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isResolved
                      ? "border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]"
                      : "border-white/[0.08] bg-[#141414] hover:border-white/20"
                  }`}
                >
                  {/* Left: Interactive Checkbox + Issue Details */}
                  <div className="flex items-start gap-3.5">
                    {/* Tick Checkbox */}
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyIssue(issueId)}
                      title={isResolved ? "Verified as fixed" : "Click to verify fix in live database"}
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition cursor-pointer ${
                        isResolved
                          ? "border-[#B3FF4C] bg-[#B3FF4C] text-black"
                          : isVerifying
                          ? "border-[#B3FF4C] bg-[#B3FF4C]/10 text-[#B3FF4C]"
                          : "border-white/20 bg-white/[0.03] text-transparent hover:border-[#B3FF4C] hover:text-[#B3FF4C]/40"
                      }`}
                    >
                      {isVerifying ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isResolved ? (
                        <Check className="size-3.5 stroke-[3]" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                    </button>

                    {/* Metadata & Description */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Table and column identifier */}
                        <span className="flex items-center gap-1 rounded bg-white/[0.04] px-2 py-0.5 font-mono text-xs font-semibold text-white">
                          <Database className="size-3 text-zinc-400" />
                          {issue.dataset_name}
                          <span className="text-zinc-500">.</span>
                          <span className="text-[#B3FF4C]">{issue.column_name}</span>
                        </span>

                        {/* Row Identifier */}
                        <span className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                          {issue.row_identifier}
                        </span>

                        {/* Bad Value */}
                        <span className="rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[11px] text-rose-300 line-through">
                          {issue.bad_value === null ? "NULL" : String(issue.bad_value)}
                        </span>

                        <SeverityBadge severity={issue.severity} />
                        <IssueStatusBadge status={issue.issue_status} />
                      </div>

                      {/* Rule Reason */}
                      <p className="text-xs text-zinc-300 leading-relaxed">{issue.reason}</p>

                      {/* Live verification inline feedback */}
                      {feedback ? (
                        <div
                          className={`mt-1.5 text-xs font-medium flex items-center gap-1.5 ${
                            feedback.fixed ? "text-[#B3FF4C]" : "text-amber-400"
                          }`}
                        >
                          {feedback.fixed ? (
                            <CheckCircle2 className="size-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="size-3.5 shrink-0" />
                          )}
                          <span>{feedback.message}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 md:shrink-0 self-end md:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isVerifying}
                      onClick={() => handleVerifyIssue(issueId)}
                      className={`h-8 px-2.5 text-xs transition ${
                        isResolved
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "border-[#B3FF4C]/30 bg-[#B3FF4C]/5 text-[#B3FF4C] hover:bg-[#B3FF4C] hover:text-black"
                      }`}
                    >
                      {isVerifying ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      {isVerifying ? "Verifying..." : isResolved ? "Re-Verify" : "Verify Fix"}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDrawer(issue)}
                      className="h-8 px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    >
                      <Sparkles className="size-3.5 text-zinc-400" />
                      Details & Fix
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* Side drawer for raw row inspection & fix suggestion */}
      <IssueDetailDrawer
        issue={selectedIssue}
        open={drawerOpen}
        suggestions={suggestions}
        onOpenChange={setDrawerOpen}
        onVerify={(issue) => handleVerifyIssue(Number(issue.id))}
        verifying={verifyingId === selectedIssue?.id}
        onStatusChange={handleStatusChange}
      />
    </AppShell>
  )
}
