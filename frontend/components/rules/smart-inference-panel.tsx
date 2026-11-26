"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api-client"
import type { SmartRuleInferenceResponse, SmartRuleSuggestion } from "@/lib/types"

interface SmartInferencePanelProps {
  data: SmartRuleInferenceResponse
  existingRules: Record<string, any>
  onClose: () => void
  onApplied: (count: number) => void
}

function formatRuleSummary(s: SmartRuleSuggestion): string {
  if (s.rule_type === "not_null_columns") return "Not Null"
  if (s.rule_type === "unique_columns") return "Unique"
  if (s.rule_type === "format_checks") return `Format: ${s.rule_config.format}`
  if (s.rule_type === "range_checks") return `Range: ${JSON.stringify(s.rule_config)}`
  if (s.rule_type === "categorical_checks") {
    const vals: string[] = s.rule_config.allowed_values || []
    return `Allowed: [${vals.join(", ")}]`
  }
  if (s.rule_type === "referential_integrity") {
    return `FK -> ${s.rule_config.foreign_table}.${s.rule_config.foreign_column}`
  }
  return JSON.stringify(s.rule_config)
}

export function SmartInferencePanel({
  data,
  existingRules,
  onClose,
  onApplied,
}: SmartInferencePanelProps) {
  const allSuggestions = useMemo(() => {
    const list: SmartRuleSuggestion[] = []
    for (const tbl of Object.values(data.tables || {})) {
      list.push(...(tbl.suggestions || []))
    }
    return list
  }, [data])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(allSuggestions.map((s) => s.id))
  )
  const [filterMode, setFilterMode] = useState<"all" | "catching" | "clean">("all")
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState("")

  const catchingCount = allSuggestions.filter((s) => s.would_fail_rows > 0).length
  const cleanCount = allSuggestions.filter((s) => s.would_fail_rows === 0).length

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(allSuggestions.map((s) => s.id)))
  }

  function selectCatchingOnly() {
    setSelectedIds(new Set(allSuggestions.filter((s) => s.would_fail_rows > 0).map((s) => s.id)))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  async function handleApplySelected() {
    const chosen = allSuggestions.filter((s) => selectedIds.has(s.id))
    if (chosen.length === 0) return

    setApplying(true)
    setError("")
    try {
      const merged: Record<string, any> = JSON.parse(JSON.stringify(existingRules || {}))

      for (const s of chosen) {
        const tbl = s.table_name
        if (!merged[tbl] || typeof merged[tbl] !== "object") {
          merged[tbl] = {}
        }
        const cfg = merged[tbl]

        // Ensure column is tracked in required_columns too
        if (!Array.isArray(cfg.required_columns)) cfg.required_columns = []
        if (!cfg.required_columns.includes(s.column_name)) {
          cfg.required_columns.push(s.column_name)
        }

        if (s.rule_type === "not_null_columns") {
          if (!Array.isArray(cfg.not_null_columns)) cfg.not_null_columns = []
          if (!cfg.not_null_columns.includes(s.column_name)) {
            cfg.not_null_columns.push(s.column_name)
          }
        } else if (s.rule_type === "unique_columns") {
          if (!Array.isArray(cfg.unique_columns)) cfg.unique_columns = []
          if (!cfg.unique_columns.includes(s.column_name)) {
            cfg.unique_columns.push(s.column_name)
          }
        } else if (s.rule_type === "format_checks") {
          if (!cfg.format_checks) cfg.format_checks = {}
          cfg.format_checks[s.column_name] = s.rule_config.format || "email"
        } else if (s.rule_type === "range_checks") {
          if (!cfg.range_checks) cfg.range_checks = {}
          cfg.range_checks[s.column_name] = {
            ...(cfg.range_checks[s.column_name] || {}),
            ...s.rule_config,
          }
        } else if (s.rule_type === "categorical_checks") {
          if (!cfg.categorical_checks) cfg.categorical_checks = {}
          cfg.categorical_checks[s.column_name] = s.rule_config
        } else if (s.rule_type === "referential_integrity") {
          if (!cfg.referential_integrity) cfg.referential_integrity = {}
          cfg.referential_integrity[s.column_name] = s.rule_config
        }
      }

      await api.saveRules(merged)
      onApplied(chosen.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save inferred rules.")
    } finally {
      setApplying(false)
    }
  }

  const tableEntries = Object.entries(data.tables || {})

  return (
    <Card className="rounded-md border border-[#B3FF4C]/40 bg-[#0d120a]">
      <CardHeader className="pb-3 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#B3FF4C]" />
            <CardTitle className="text-sm font-semibold text-white">
              Data-Aware Smart Rule Inference
            </CardTitle>
            <span className="rounded-full bg-[#B3FF4C]/15 border border-[#B3FF4C]/30 px-2 py-0.5 text-[0.65rem] font-bold text-[#B3FF4C]">
              {allSuggestions.length} SUGGESTIONS FOUND
            </span>
          </div>
          <CardDescription className="text-xs text-zinc-400 mt-1">
            Scanned live rows in <code className="text-zinc-200">{data.database}</code> to detect real patterns, categories, formats, and outliers. Review and accept rules below.
          </CardDescription>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white self-start sm:self-auto"
          title="Close Inference Studio"
        >
          <X className="size-4" />
        </button>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Filter & Quick Select Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                filterMode === "all"
                  ? "bg-white/15 text-white"
                  : "bg-white/[0.03] text-zinc-400 hover:text-white"
              }`}
            >
              All ({allSuggestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("catching")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                filterMode === "catching"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-white/[0.03] text-zinc-400 hover:text-amber-300"
              }`}
            >
              Catches Live Defects ({catchingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("clean")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                filterMode === "clean"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-white/[0.03] text-zinc-400 hover:text-emerald-300"
              }`}
            >
              100% Clean Match ({cleanCount})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={selectAll} className="text-[#B3FF4C] hover:underline">
              Select All
            </button>
            <span className="text-zinc-600">•</span>
            <button type="button" onClick={selectCatchingOnly} className="text-amber-300 hover:underline">
              Only Defect-Catching
            </button>
            <span className="text-zinc-600">•</span>
            <button type="button" onClick={clearAll} className="text-zinc-400 hover:text-white">
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Suggestions Grouped by Table */}
        <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
          {tableEntries.map(([tblName, tblInfo]) => {
            const items = (tblInfo.suggestions || []).filter((s) => {
              if (filterMode === "catching") return s.would_fail_rows > 0
              if (filterMode === "clean") return s.would_fail_rows === 0
              return true
            })
            if (items.length === 0) return null

            return (
              <div key={tblName} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  <span className="size-1.5 rounded-full bg-[#B3FF4C]" />
                  <span>{tblName}</span>
                  <span className="text-[0.68rem] font-normal text-zinc-500">
                    ({tblInfo.row_count} rows sampled • {items.length} rules)
                  </span>
                </div>

                <div className="grid gap-2">
                  {items.map((s) => {
                    const isChecked = selectedIds.has(s.id)
                    const catchesBugs = s.would_fail_rows > 0
                    return (
                      <label
                        key={s.id}
                        className={`flex items-start gap-3 rounded-md border p-3 text-xs cursor-pointer transition ${
                          isChecked
                            ? "border-[#B3FF4C]/40 bg-[#141414]"
                            : "border-white/[0.06] bg-white/[0.01] opacity-65 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(s.id)}
                          className="mt-0.5 size-4 rounded accent-[#B3FF4C] cursor-pointer shrink-0"
                        />

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold text-white">
                                {s.column_name}
                              </span>
                              <code className="rounded bg-white/[0.06] border border-white/10 px-1.5 py-0.5 text-[0.68rem] text-[#B3FF4C]">
                                {formatRuleSummary(s)}
                              </code>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border ${
                                  s.confidence >= 95
                                    ? "bg-[#B3FF4C]/10 border-[#B3FF4C]/30 text-[#B3FF4C]"
                                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                }`}
                              >
                                {s.confidence}% Match
                              </span>

                              {catchesBugs ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[0.65rem] font-semibold text-rose-300">
                                  <AlertTriangle className="size-3" />
                                  Flags {s.would_fail_rows} row{s.would_fail_rows > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-300">
                                  <CheckCircle2 className="size-3" />
                                  Clean ({s.matching_rows} rows)
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-zinc-400">{s.reason}</p>

                          {s.sample_outliers && s.sample_outliers.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[0.66rem] text-zinc-500">Outliers that will be flagged:</span>
                              {s.sample_outliers.map((out, i) => (
                                <span
                                  key={i}
                                  className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.2 font-mono text-[0.66rem] text-rose-200"
                                >
                                  {out}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Accept Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.08]">
          <span className="text-xs text-zinc-400">
            <strong className="text-white">{selectedIds.size}</strong> of {allSuggestions.length} rules selected to persist in PostgreSQL
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-zinc-400 hover:text-white">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0 || applying}
              onClick={handleApplySelected}
              className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] text-xs px-4 gap-1.5"
            >
              <Check className="size-3.5" />
              {applying ? "Saving Rules..." : `Accept & Save ${selectedIds.size} Rules`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
