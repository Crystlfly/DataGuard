"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui-custom/page-header"
import { SeverityBadge } from "@/components/ui-custom/severity-badge"
import { StatusBadge } from "@/components/ui-custom/status-badge"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type { AlertRecord } from "@/lib/types"

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL")
  const [actionMessage, setActionMessage] = useState("")
  const [actionError, setActionError] = useState("")
  const [dismissingId, setDismissingId] = useState<number | null>(null)
  const [dismissingAll, setDismissingAll] = useState(false)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    setActionError("")
    try {
      const data = await api.alerts()
      setAlerts(data)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load notification history.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const openAlerts = useMemo(() => alerts.filter((a) => !a.is_resolved), [alerts])
  const resolvedAlerts = useMemo(() => alerts.filter((a) => a.is_resolved), [alerts])
  const criticalAlerts = useMemo(
    () => alerts.filter((a) => (a.severity || "").toUpperCase() === "CRITICAL"),
    [alerts]
  )

  const latestAlertTime = useMemo(() => {
    if (!alerts.length) return null
    return alerts[0]?.created_at
  }, [alerts])

  // Dismiss single alert
  async function handleDismiss(alertId: number) {
    setDismissingId(alertId)
    setActionMessage("")
    setActionError("")
    try {
      await api.resolveAlert(alertId)
      setAlerts((current) =>
        current.map((row) => (row.id === alertId ? { ...row, is_resolved: true } : row))
      )
      setActionMessage(`Notification #${alertId} dismissed.`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to dismiss notification.")
    } finally {
      setDismissingId(null)
    }
  }

  // Dismiss all active alerts
  async function handleDismissAll() {
    if (!openAlerts.length) return
    setDismissingAll(true)
    setActionMessage("Dismissing all active notifications...")
    setActionError("")
    try {
      for (const alert of openAlerts) {
        try {
          await api.resolveAlert(alert.id)
        } catch {
          // continue
        }
      }
      await loadAlerts()
      setActionMessage("All active notifications have been dismissed.")
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to dismiss all notifications.")
    } finally {
      setDismissingAll(false)
    }
  }

  // Filtered notifications
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesMsg = alert.message?.toLowerCase().includes(q)
        const matchesType = alert.alert_type?.toLowerCase().includes(q)
        const matchesId = String(alert.id).includes(q)
        if (!matchesMsg && !matchesType && !matchesId) return false
      }

      // Severity filter
      if (severityFilter !== "ALL" && alert.severity !== severityFilter) {
        return false
      }

      // Status filter
      if (statusFilter === "ACTIVE" && alert.is_resolved) return false
      if (statusFilter === "RESOLVED" && !alert.is_resolved) return false

      return true
    })
  }, [alerts, searchQuery, severityFilter, statusFilter])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Run Notification History"
        subtitle="Review event logs, failure triggers, and operational notifications from data quality checks."
        onRefresh={loadAlerts}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissAll}
              disabled={dismissingAll || !openAlerts.length}
              className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white text-xs h-8"
            >
              {dismissingAll ? (
                <Loader2 className="size-3.5 animate-spin text-[#B3FF4C]" />
              ) : (
                <Check className="size-3.5 text-[#B3FF4C]" />
              )}
              {dismissingAll ? "Dismissing..." : `Dismiss All Active (${openAlerts.length})`}
            </Button>
            <Link href="/remediation">
              <Button
                size="sm"
                className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] transition text-xs h-8"
              >
                <Wrench className="size-3.5" />
                Go to Remediation Center
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-400">Total Notifications</div>
              <div className="mt-1 text-2xl font-bold text-white">{alerts.length}</div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md bg-white/[0.04] text-zinc-300">
              <BellRing className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-400">Active / Unresolved</div>
              <div className="mt-1 text-2xl font-bold text-amber-400">{openAlerts.length}</div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
              <AlertTriangle className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-400">Critical Triggers</div>
              <div className="mt-1 text-2xl font-bold text-rose-400">{criticalAlerts.length}</div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
              <Flame className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-400">Latest Trigger</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {latestAlertTime ? formatDateTime(latestAlertTime) : "No runs yet"}
              </div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md bg-white/[0.04] text-[#B3FF4C]">
              <Clock className="size-4" />
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Filter and Search Bar */}
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-2.5 size-3.5 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search notification messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs border-white/10 bg-white/[0.02] text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-[#B3FF4C]"
              />
            </div>

            {/* Severity and Status Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filters */}
              <div className="flex rounded-md border border-white/10 bg-black/40 p-0.5 text-xs">
                {(["ALL", "ACTIVE", "RESOLVED"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      statusFilter === s
                        ? "bg-[#B3FF4C] text-black font-semibold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {s === "ALL" ? "All Status" : s === "ACTIVE" ? `Active (${openAlerts.length})` : "Dismissed"}
                  </button>
                ))}
              </div>

              {/* Severity Filters */}
              <div className="flex rounded-md border border-white/10 bg-black/40 p-0.5 text-xs">
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`rounded px-2 py-1 text-xs font-medium transition cursor-pointer ${
                      severityFilter === sev
                        ? "bg-white/20 text-white font-semibold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {sev === "ALL" ? "All Severity" : sev}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Feed */}
      {loading ? (
        <div className="rounded-md border border-white/[0.08] bg-[#141414] p-12 text-center text-zinc-400">
          <Loader2 className="mx-auto size-6 animate-spin text-[#B3FF4C]" />
          <div className="mt-2 text-xs">Loading notifications...</div>
        </div>
      ) : !filteredAlerts.length ? (
        <div className="rounded-md border border-white/[0.08] bg-[#141414] p-12 text-center">
          <BellRing className="mx-auto size-8 text-zinc-500" />
          <div className="mt-3 text-sm font-semibold text-white">No notifications found</div>
          <p className="mt-1 text-xs text-zinc-400">
            {searchQuery || severityFilter !== "ALL" || statusFilter !== "ALL"
              ? "Try clearing your filters or search query."
              : "No check failures or notifications have been logged yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAlerts.map((alert) => {
            const isDismissing = dismissingId === alert.id
            const isResolved = alert.is_resolved
            const sev = (alert.severity || "LOW").toUpperCase()

            return (
              <div
                key={alert.id}
                className={`rounded-md border p-3.5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isResolved
                    ? "border-white/[0.04] bg-white/[0.01] opacity-70"
                    : "border-white/[0.08] bg-[#141414] hover:border-white/20"
                }`}
              >
                {/* Left: Icon + Content */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border ${
                      sev === "CRITICAL"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                        : sev === "HIGH"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : sev === "MEDIUM"
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {sev === "CRITICAL" ? (
                      <Flame className="size-4" />
                    ) : sev === "HIGH" ? (
                      <AlertTriangle className="size-4" />
                    ) : sev === "MEDIUM" ? (
                      <BellRing className="size-4" />
                    ) : (
                      <Info className="size-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-xs text-white">
                        Notification #{alert.id}
                      </span>
                      <SeverityBadge severity={alert.severity} />
                      <StatusBadge status={isResolved ? "RESOLVED" : "ACTIVE"} />
                      <span className="text-[11px] text-zinc-500">
                        {formatDateTime(alert.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed max-w-4xl">
                      {alert.message}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 md:shrink-0 self-end md:self-center">
                  <Link href="/remediation">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-zinc-400 hover:text-[#B3FF4C] hover:bg-white/[0.04]"
                    >
                      <Wrench className="size-3 text-zinc-400" />
                      Fix in Remediation
                    </Button>
                  </Link>

                  {!isResolved ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDismissing}
                      onClick={() => handleDismiss(alert.id)}
                      className="h-7 px-2.5 text-xs border-white/10 text-zinc-300 hover:border-white/20 hover:text-white"
                    >
                      {isDismissing ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3 text-[#B3FF4C]" />
                      )}
                      Dismiss
                    </Button>
                  ) : (
                    <span className="text-[11px] text-zinc-500 italic px-2">Dismissed</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
