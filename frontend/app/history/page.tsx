"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  History,
  Loader2,
  RotateCcw,
  RotateCw,
  Search,
  Table2,
  Undo2,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { EmptyState } from "@/components/ui-custom/empty-state"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type { TimeTravelHistoryResponse, TimeTravelMutation } from "@/lib/types"

function formatVal(val: any): string {
  if (val === null || val === undefined) return "NULL"
  return String(val)
}

function formatPk(pk: Record<string, any>): string {
  const entries = Object.entries(pk || {})
  if (!entries.length) return "row"
  return entries.map(([k, v]) => `${k}=${v}`).join(", ")
}

export default function TimeTravelHistoryPage() {
  const [data, setData] = useState<TimeTravelHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"ALL" | "APPLIED" | "REVERTED">("ALL")
  const [tableFilter, setTableFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await api.timeTravelHistory({
        tableName: tableFilter,
        status: statusFilter,
      })
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Time-Travel history.")
    } finally {
      setLoading(false)
    }
  }, [tableFilter, statusFilter])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const mutations = data?.mutations ?? []
  const filteredMutations = useMemo(() => {
    if (!searchQuery.trim()) return mutations
    const q = searchQuery.toLowerCase()
    return mutations.filter(
      (m) =>
        m.table_name.toLowerCase().includes(q) ||
        m.column_name.toLowerCase().includes(q) ||
        formatPk(m.primary_key).toLowerCase().includes(q) ||
        formatVal(m.old_value).toLowerCase().includes(q) ||
        formatVal(m.new_value).toLowerCase().includes(q) ||
        m.changed_by.toLowerCase().includes(q)
    )
  }, [mutations, searchQuery])

  const latestApplied = useMemo(
    () => mutations.find((m) => m.status === "APPLIED"),
    [mutations]
  )

  async function handleUndo(m: TimeTravelMutation) {
    setBusyId(m.id)
    setMessage("")
    setError("")
    try {
      const res = await api.undoMutation(m.id)
      setMessage(res.message)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo change.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleRedo(m: TimeTravelMutation) {
    setBusyId(m.id)
    setMessage("")
    setError("")
    try {
      const res = await api.redoMutation(m.id)
      setMessage(res.message)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-apply change.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevertToCheckpoint(m: TimeTravelMutation) {
    const newerAppliedCount = mutations.filter(
      (item) => item.status === "APPLIED" && item.id >= m.id
    ).length
    if (
      newerAppliedCount > 1 &&
      !confirm(
        `Time-travel back to before Edit #${m.id}? This will revert ${newerAppliedCount} database edits in reverse chronological order.`
      )
    ) {
      return
    }

    setBusyId(m.id)
    setMessage("")
    setError("")
    try {
      const res = await api.revertToCheckpoint(m.id)
      setMessage(res.message)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkpoint rollback failed.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Time-Travel & Undo"
        subtitle="Audit timeline of every PostgreSQL cell edit and remediation fix with 1-click Undo, Redo, and checkpoint rollback."
        onRefresh={loadHistory}
        actions={
          <div className="flex items-center gap-2">
            {latestApplied && (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId !== null}
                onClick={() => handleUndo(latestApplied)}
                className="h-7 px-3 text-xs border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-1.5"
              >
                <Undo2 className="size-3.5" />
                Undo Latest (#{latestApplied.id})
              </Button>
            )}
            <Link href="/remediation">
              <Button
                size="sm"
                className="h-7 px-3 text-xs bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] gap-1.5"
              >
                <Table2 className="size-3.5" />
                Open Spreadsheet X-Ray
              </Button>
            </Link>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <EnterpriseMetricCard
          title="Recorded Mutations"
          value={data?.total ?? 0}
          description={`Tracked in ${data?.database ?? "active DB"}`}
          icon={History}
          tone="blue"
        />
        <EnterpriseMetricCard
          title="Currently Applied"
          value={data?.applied_count ?? 0}
          description="Live in PostgreSQL right now"
          icon={CheckCircle2}
          tone="green"
        />
        <EnterpriseMetricCard
          title="Undone / Reverted"
          value={data?.reverted_count ?? 0}
          description="Rolled back to prior state"
          icon={RotateCcw}
          tone="amber"
        />
        <EnterpriseMetricCard
          title="Tables Modified"
          value={data?.tables.length ?? 0}
          description={data?.tables.length ? data.tables.join(", ") : "No tables edited yet"}
          icon={Database}
          tone="slate"
        />
      </div>

      {/* Feedback / Error Banners */}
      {message && (
        <Card className="rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]">
          <CardContent className="p-3 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{message}</span>
            </div>
            <button onClick={() => setMessage("")} className="hover:underline">
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
          <CardContent className="p-3 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="hover:underline">
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["ALL", "APPLIED", "REVERTED"] as const).map((statusOpt) => (
            <button
              key={statusOpt}
              type="button"
              onClick={() => setStatusFilter(statusOpt)}
              className={`rounded px-3 py-1 text-xs font-medium transition cursor-pointer ${
                statusFilter === statusOpt
                  ? "bg-[#B3FF4C] text-black font-semibold"
                  : "bg-white/[0.03] border border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              {statusOpt === "ALL" ? "All Edits" : statusOpt === "APPLIED" ? "Applied" : "Reverted"}
            </button>
          ))}

          {data && data.tables.length > 0 && (
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="ml-2 rounded-md border border-white/10 bg-[#0c0c0c] px-2.5 py-1 text-xs text-white outline-none focus:border-[#B3FF4C]"
            >
              <option value="ALL">All Tables</option>
              {data.tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 size-3.5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by table, column, key, or value..."
            className="pl-8 h-8 text-xs border-white/10 bg-[#0c0c0c] text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-[#B3FF4C]"
          />
        </div>
      </div>

      {/* Interactive Mutation Timeline */}
      {loading ? (
        <div className="rounded-md border border-white/[0.08] bg-[#141414] p-12 text-center text-zinc-400">
          <Loader2 className="mx-auto size-5 animate-spin text-[#B3FF4C] mb-2" />
          <span className="text-xs">Loading Time-Travel mutation log...</span>
        </div>
      ) : filteredMutations.length === 0 ? (
        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-8">
            <EmptyState
              title="No data edits recorded yet"
              description="Whenever you edit a cell in Spreadsheet X-Ray or apply a remediation fix, it appears here with 1-click Undo & Redo."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredMutations.map((m) => {
            const isApplied = m.status === "APPLIED"
            const isBusy = busyId === m.id
            const newerAppliedCount = mutations.filter(
              (other) => other.status === "APPLIED" && other.id > m.id
            ).length

            return (
              <div
                key={m.id}
                className={`rounded-md border p-4 transition ${
                  isApplied
                    ? "border-white/[0.08] bg-[#141414] hover:border-white/[0.15]"
                    : "border-zinc-800 bg-[#0d0d0d] opacity-75"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left Info + Value Diff */}
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.68rem] text-zinc-300">
                        #{m.id}
                      </span>
                      <span className="font-mono font-semibold text-white">
                        {m.table_name}.{m.column_name}
                      </span>
                      <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[0.68rem] text-[#B3FF4C]">
                        {formatPk(m.primary_key)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold border ${
                          isApplied
                            ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {isApplied ? "APPLIED" : "REVERTED"}
                      </span>
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[0.65rem] text-zinc-400">
                        {m.source === "INLINE_EDIT" ? "Spreadsheet Edit" : "Remediation Job"}
                      </span>
                    </div>

                    {/* Visual Before -> After Diff */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span
                        className={`rounded border px-2.5 py-1 ${
                          isApplied
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-200 line-through opacity-80"
                            : "border-[#B3FF4C]/40 bg-[#B3FF4C]/15 text-[#B3FF4C] font-semibold"
                        }`}
                        title="Original value before edit"
                      >
                        {formatVal(m.old_value)}
                      </span>

                      <ArrowRight className="size-3.5 text-zinc-500" />

                      <span
                        className={`rounded border px-2.5 py-1 ${
                          isApplied
                            ? "border-[#B3FF4C]/40 bg-[#B3FF4C]/15 text-[#B3FF4C] font-semibold"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 line-through"
                        }`}
                        title="New edited value"
                      >
                        {formatVal(m.new_value)}
                      </span>

                      {m.resolved_issue_ids.length > 0 && (
                        <span className="font-sans text-[0.68rem] text-zinc-400 ml-1">
                          • Linked issues: {m.resolved_issue_ids.map((id) => `#${id}`).join(", ")}
                        </span>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-3 text-[0.68rem] text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDateTime(m.created_at)}
                      </span>
                      <span>by <strong className="text-zinc-300">{m.changed_by}</strong></span>
                      {m.reverted_at && (
                        <span className="text-amber-300/90">
                          • Reverted {formatDateTime(m.reverted_at)} by {m.reverted_by || "user"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isApplied ? (
                      <>
                        {newerAppliedCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId !== null}
                            onClick={() => handleRevertToCheckpoint(m)}
                            className="h-8 px-2.5 text-xs border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.08] hover:text-white gap-1.5"
                            title={`Undo this edit and all ${newerAppliedCount} newer edits above it`}
                          >
                            <History className="size-3.5" />
                            Time-Travel Before This ({newerAppliedCount + 1})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => handleUndo(m)}
                          className="h-8 px-3 text-xs border border-amber-500/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 gap-1.5"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          Undo
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId !== null}
                        onClick={() => handleRedo(m)}
                        className="h-8 px-3 text-xs border-[#B3FF4C]/35 bg-[#B3FF4C]/10 text-[#B3FF4C] hover:bg-[#B3FF4C]/20 gap-1.5"
                      >
                        {isBusy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCw className="size-3.5" />
                        )}
                        Re-Apply (Redo)
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
