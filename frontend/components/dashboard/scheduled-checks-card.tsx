"use client"

import { useEffect, useState } from "react"
import { Check, Clock, Play, Power, RefreshCw, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type { SchedulerConfig } from "@/lib/types"

const FREQUENCY_OPTIONS = [
  { value: 15, label: "Every 15 mins" },
  { value: 60, label: "Every 1 hour" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Daily (24h)" },
]

export function ScheduledChecksCard({ onRunTriggered }: { onRunTriggered?: () => void }) {
  const [config, setConfig] = useState<SchedulerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [runningNow, setRunningNow] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadConfig() {
    try {
      const res = await api.scheduler()
      setConfig(res)
    } catch {
      // fallback if not available
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
    const interval = setInterval(loadConfig, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleToggleSchedule() {
    if (!config) return
    setUpdating(true)
    setMessage(null)
    try {
      const nextEnabled = !config.enabled
      const res = await api.updateScheduler({
        enabled: nextEnabled,
        interval_minutes: config.interval_minutes || 60,
      })
      setConfig(res)
      setMessage(nextEnabled ? "Autonomous background checks activated." : "Background checks paused.")
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update schedule.")
    } finally {
      setUpdating(false)
    }
  }

  async function handleChangeInterval(newMinutes: number) {
    if (!config) return
    setUpdating(true)
    setMessage(null)
    try {
      const res = await api.updateScheduler({
        enabled: config.enabled,
        interval_minutes: newMinutes,
      })
      setConfig(res)
      setMessage(`Schedule updated to run every ${FREQUENCY_OPTIONS.find((o) => o.value === newMinutes)?.label ?? `${newMinutes}m`}.`)
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update frequency.")
    } finally {
      setUpdating(false)
    }
  }

  async function handleRunNow() {
    setRunningNow(true)
    setMessage("Triggering scheduled background check run...")
    try {
      await api.triggerScheduledRun()
      setMessage("Scheduled run completed successfully.")
      await loadConfig()
      onRunTriggered?.()
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to trigger run.")
    } finally {
      setRunningNow(false)
    }
  }

  const isEnabled = Boolean(config?.enabled)
  const isRunning = Boolean(config?.is_running || runningNow)

  return (
    <Card className="rounded-md border border-white/[0.08] bg-[#0c0c0c] text-zinc-100 overflow-hidden shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Status & Timing Details */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border ${
                isEnabled
                  ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]"
                  : "border-white/10 bg-white/[0.03] text-zinc-400"
              }`}
            >
              <Clock className="size-4" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white">
                  Autonomous Background Checks
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-medium border ${
                    isEnabled
                      ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      isEnabled ? "bg-[#B3FF4C]" : "bg-zinc-500"
                    }`}
                  />
                  {isEnabled ? "ACTIVE" : "PAUSED"}
                </span>

                {config?.database_name && (
                  <span className="text-[0.68rem] font-mono text-zinc-500 bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded">
                    DB: {config.database_name}
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                {isEnabled ? (
                  <>
                    <span>
                      Frequency:{" "}
                      <strong className="text-zinc-200">
                        {FREQUENCY_OPTIONS.find((o) => o.value === config?.interval_minutes)?.label ??
                          `Every ${config?.interval_minutes ?? 60}m`}
                      </strong>
                    </span>
                    {config?.next_run_time && (
                      <span className="text-zinc-400">
                        • Next run:{" "}
                        <strong className="text-[#B3FF4C] font-mono">
                          {formatDateTime(config.next_run_time)}
                        </strong>
                      </span>
                    )}
                  </>
                ) : (
                  <span>
                    Background checks are currently paused. Turn on to monitor database quality automatically.
                  </span>
                )}

                {config?.last_run_time && (
                  <span className="text-zinc-500">
                    • Last executed: {formatDateTime(config.last_run_time)}
                    {config.last_run_status && (
                      <span
                        className={`ml-1 font-semibold ${
                          config.last_run_status === "SUCCESS"
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        ({config.last_run_status})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls: Frequency Selector + Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
            {/* Frequency Options Pills */}
            <div className="flex items-center rounded-md border border-white/10 bg-white/[0.02] p-0.5">
              {FREQUENCY_OPTIONS.map((opt) => {
                const isSelected = (config?.interval_minutes ?? 60) === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={updating}
                    onClick={() => handleChangeInterval(opt.value)}
                    className={`rounded px-2.5 py-1 text-[0.7rem] font-medium transition ${
                      isSelected
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    {opt.label.replace("Every ", "")}
                  </button>
                )
              })}
            </div>

            {/* Run Once Immediately */}
            <Button
              variant="outline"
              size="sm"
              disabled={isRunning || updating}
              onClick={handleRunNow}
              className="h-7 px-2.5 text-xs border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
              title="Run a background check immediately"
            >
              <RefreshCw className={`size-3.5 mr-1 ${isRunning ? "animate-spin text-[#B3FF4C]" : ""}`} />
              {isRunning ? "Running..." : "Run Once"}
            </Button>

            {/* Enable/Pause Toggle */}
            <Button
              size="sm"
              disabled={updating || loading}
              onClick={handleToggleSchedule}
              className={`h-7 px-3 text-xs font-semibold transition ${
                isEnabled
                  ? "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 hover:text-white"
                  : "bg-[#B3FF4C] text-black hover:bg-[#a3f03b]"
              }`}
            >
              <Power className="size-3.5 mr-1" />
              {isEnabled ? "Pause Schedule" : "Enable Schedule"}
            </Button>
          </div>
        </div>

        {message && (
          <div className="mt-3 pt-2.5 border-t border-white/5 text-[0.72rem] font-medium text-[#B3FF4C] flex items-center gap-1.5">
            <Check className="size-3.5 text-[#B3FF4C]" />
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
