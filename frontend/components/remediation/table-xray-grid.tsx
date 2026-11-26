"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Filter,
  Loader2,
  Pencil,
  RefreshCw,
  Table2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api-client"
import type { TableXrayCellIssue, TableXrayResponse, TableXrayRow } from "@/lib/types"

interface TableXrayGridProps {
  onDataFixed?: () => void
}

export function TableXrayGrid({ onDataFixed }: TableXrayGridProps) {
  const [activeTable, setActiveTable] = useState<string>("")
  const [xray, setXray] = useState<TableXrayResponse | null>(null)
  const [defectsOnly, setDefectsOnly] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")
  const [feedback, setFeedback] = useState<{ type: "success" | "warn"; text: string } | null>(null)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number
    columnName: string
    primaryKey: Record<string, any>
    nullable: boolean
  } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [savingCell, setSavingCell] = useState<boolean>(false)
  const [cellError, setCellError] = useState<string>("")
  const [justFixedCells, setJustFixedCells] = useState<Set<string>>(new Set())

  const loadXray = useCallback(
    async (tableName?: string, onlyDefects = defectsOnly) => {
      setLoading(true)
      setError("")
      try {
        let targetTable = tableName || activeTable
        if (!targetTable) {
          const schema = await api.databaseSchema()
          const nonInternal = schema.tables.filter((t) => !t.is_internal)
          if (nonInternal.length === 0) {
            setError("No source database tables found.")
            setLoading(false)
            return
          }
          // Prefer a table with open issues if one exists, otherwise first table
          targetTable = nonInternal[0].name
          setActiveTable(targetTable)
        }

        const res = await api.tableXray(targetTable, {
          defectsOnly: onlyDefects,
          limit: 150,
        })
        setXray(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load live spreadsheet grid.")
      } finally {
        setLoading(false)
      }
    },
    [activeTable, defectsOnly]
  )

  useEffect(() => {
    loadXray()
  }, [loadXray])

  function handleSelectTable(tblName: string) {
    setActiveTable(tblName)
    setEditingCell(null)
    setCellError("")
    setFeedback(null)
    loadXray(tblName, defectsOnly)
  }

  function handleToggleDefectsOnly() {
    const next = !defectsOnly
    setDefectsOnly(next)
    setEditingCell(null)
    loadXray(activeTable, next)
  }

  function startEdit(row: TableXrayRow, colName: string, isPk: boolean, nullable: boolean) {
    if (isPk) return
    if (!row.primary_key || Object.keys(row.primary_key).length === 0) {
      setError("Inline editing requires a primary key or 'id' column on the table.")
      return
    }
    const rawVal = row.values[colName]
    setEditingCell({
      rowIndex: row.row_index,
      columnName: colName,
      primaryKey: row.primary_key,
      nullable,
    })
    setEditValue(rawVal === null || rawVal === undefined ? "" : String(rawVal))
    setCellError("")
  }

  function cancelEdit() {
    setEditingCell(null)
    setCellError("")
  }

  async function commitEdit(overrideValue?: any) {
    if (!editingCell || !xray) return
    setSavingCell(true)
    setCellError("")
    setFeedback(null)

    const valToSend = overrideValue !== undefined ? overrideValue : editValue

    try {
      const res = await api.editCellInline({
        table_name: xray.table_name,
        primary_key: editingCell.primaryKey,
        column_name: editingCell.columnName,
        new_value: valToSend,
      })

      const cellKey = `${editingCell.rowIndex}:${editingCell.columnName}`
      if (res.is_clean) {
        setJustFixedCells((prev) => new Set(prev).add(cellKey))
        setFeedback({ type: "success", text: res.message })
        setTimeout(() => {
          setJustFixedCells((prev) => {
            const next = new Set(prev)
            next.delete(cellKey)
            return next
          })
        }, 4000)
      } else {
        setFeedback({ type: "warn", text: res.message })
      }

      setEditingCell(null)
      await loadXray(xray.table_name, defectsOnly)
      onDataFixed?.()
    } catch (err) {
      setCellError(err instanceof Error ? err.message : "Failed to save cell edit.")
    } finally {
      setSavingCell(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Table Switcher & Toolbar */}
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader className="pb-3 border-b border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Table2 className="size-4 text-[#B3FF4C]" />
              <CardTitle className="text-sm font-semibold text-white">
                Live Table X-Ray & Inline Cell Editor
              </CardTitle>
              {xray && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.66rem] font-bold border ${
                    xray.defective_cells > 0
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                      : "bg-[#B3FF4C]/15 border-[#B3FF4C]/30 text-[#B3FF4C]"
                  }`}
                >
                  {xray.defective_cells} BAD CELL{xray.defective_cells === 1 ? "" : "S"} HIGHLIGHTED
                </span>
              )}
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-1">
              Click any cell (especially highlighted red cells) to edit directly in PostgreSQL. Press <kbd className="rounded bg-white/10 px-1 text-zinc-200">Enter</kbd> to save and verify rules live.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleDefectsOnly}
              className={`h-7 text-xs gap-1.5 ${
                defectsOnly
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
              }`}
            >
              <Filter className="size-3" />
              {defectsOnly ? "Showing Defect Rows Only" : "Filter: Defect Rows Only"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadXray(activeTable, defectsOnly)}
              disabled={loading}
              className="h-7 text-xs border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] gap-1"
            >
              <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              Refresh Grid
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-3 space-y-3">
          {/* Table Selector Pills */}
          {xray?.tables && xray.tables.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-zinc-500 mr-1">
                Table:
              </span>
              {xray.tables.map((t) => {
                const isSelected = t.name === xray.table_name
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleSelectTable(t.name)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? "bg-[#B3FF4C] text-black font-semibold"
                        : "bg-white/[0.03] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.07]"
                    }`}
                  >
                    <Database className="size-3" />
                    <span>{t.name}</span>
                    {t.open_issues > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[0.62rem] font-bold ${
                          isSelected
                            ? "bg-black/20 text-black"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {t.open_issues}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Feedback / Error Banners */}
          {feedback && (
            <div
              className={`rounded-md border p-2.5 text-xs flex items-center justify-between ${
                feedback.type === "success"
                  ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {cellError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/15 p-2.5 text-xs text-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
                <span>Edit validation error: {cellError}</span>
              </div>
              <button onClick={() => setCellError("")} className="text-xs underline">
                Close
              </button>
            </div>
          )}

          {/* Spreadsheet Grid */}
          {loading && !xray ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              <Loader2 className="mx-auto size-5 animate-spin text-[#B3FF4C] mb-2" />
              Loading live rows from PostgreSQL...
            </div>
          ) : xray && xray.rows.length === 0 ? (
            <div className="rounded-md border border-white/[0.06] bg-[#0c0c0c] py-12 text-center text-xs text-zinc-400">
              {defectsOnly
                ? `No defective rows remain in '${xray.table_name}'. Everything is clean!`
                : `Table '${xray.table_name}' has 0 rows.`}
            </div>
          ) : xray ? (
            <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#090909]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#121212] text-zinc-400">
                    <th className="w-10 border-r border-white/[0.06] px-2 py-2 text-center font-mono text-[0.65rem] text-zinc-500">
                      #
                    </th>
                    {xray.columns.map((col) => (
                      <th
                        key={col.name}
                        className="border-r border-white/[0.06] last:border-r-0 px-3 py-2 text-left whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-zinc-200">{col.name}</span>
                          {col.is_primary_key && (
                            <span className="rounded bg-[#B3FF4C]/20 px-1 py-0.2 text-[0.58rem] font-bold text-[#B3FF4C]">
                              PK
                            </span>
                          )}
                        </div>
                        <div className="text-[0.62rem] font-mono font-normal text-zinc-500">
                          {col.data_type}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {xray.rows.map((row) => (
                    <tr
                      key={row.row_index}
                      className={row.has_defects ? "bg-rose-500/[0.02]" : "hover:bg-white/[0.02]"}
                    >
                      <td className="border-r border-white/[0.06] px-2 py-2 text-center font-mono text-[0.68rem] text-zinc-500">
                        {row.row_index + 1}
                      </td>
                      {xray.columns.map((col) => {
                        const cellIssues: TableXrayCellIssue[] = row.cell_issues[col.name] || []
                        const hasDefect = cellIssues.length > 0
                        const cellKey = `${row.row_index}:${col.name}`
                        const isJustFixed = justFixedCells.has(cellKey)
                        const isEditing =
                          editingCell?.rowIndex === row.row_index &&
                          editingCell?.columnName === col.name
                        const val = row.values[col.name]
                        const isNull = val === null || val === undefined

                        return (
                          <td
                            key={col.name}
                            onClick={() => {
                              if (!isEditing) {
                                startEdit(row, col.name, col.is_primary_key, col.nullable)
                              }
                            }}
                            title={
                              col.is_primary_key
                                ? "Primary key column (read-only)"
                                : hasDefect
                                ? cellIssues.map((i) => i.reason).join(" | ")
                                : "Click to edit inline"
                            }
                            className={`relative border-r border-white/[0.06] last:border-r-0 px-2.5 py-1.5 font-mono transition min-w-[130px] max-w-[260px] ${
                              isEditing
                                ? "bg-[#1a1f16] p-1"
                                : isJustFixed
                                ? "bg-[#B3FF4C]/20 text-[#B3FF4C] ring-1 ring-inset ring-[#B3FF4C]/60"
                                : hasDefect
                                ? "bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-500/45 hover:bg-rose-500/25 cursor-pointer"
                                : col.is_primary_key
                                ? "text-zinc-400 bg-white/[0.01]"
                                : "text-zinc-200 hover:bg-white/[0.05] cursor-pointer group"
                            }`}
                          >
                            {isEditing ? (
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Input
                                  autoFocus
                                  value={editValue}
                                  disabled={savingCell}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      commitEdit()
                                    } else if (e.key === "Escape") {
                                      e.preventDefault()
                                      cancelEdit()
                                    }
                                  }}
                                  className="h-7 px-2 py-0.5 text-xs font-mono bg-[#090909] border-[#B3FF4C] text-white focus-visible:ring-0"
                                />
                                <button
                                  type="button"
                                  disabled={savingCell}
                                  onClick={() => commitEdit()}
                                  className="rounded bg-[#B3FF4C] p-1 text-black hover:bg-[#a3f03b]"
                                  title="Save & Verify (Enter)"
                                >
                                  {savingCell ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Check className="size-3.5" />
                                  )}
                                </button>
                                {col.nullable && (
                                  <button
                                    type="button"
                                    disabled={savingCell}
                                    onClick={() => commitEdit(null)}
                                    className="rounded border border-white/15 bg-white/5 px-1.5 py-1 text-[0.6rem] text-zinc-300 hover:text-white"
                                    title="Set SQL NULL"
                                  >
                                    NULL
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={savingCell}
                                  onClick={cancelEdit}
                                  className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                                  title="Cancel (Esc)"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className={`truncate ${isNull ? "italic text-zinc-500" : ""}`}>
                                  {isNull ? "NULL" : String(val)}
                                </span>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isJustFixed && <CheckCircle2 className="size-3.5 text-[#B3FF4C]" />}
                                  {hasDefect && (
                                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/25 px-1.5 py-0.2 text-[0.6rem] font-sans font-semibold text-rose-200">
                                      <AlertTriangle className="size-2.5 text-rose-300" />
                                      {cellIssues[0].check_type.replace("_check", "")}
                                    </span>
                                  )}
                                  {!hasDefect && !col.is_primary_key && !isJustFixed && (
                                    <Pencil className="size-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Inline Rule Failure Hint Line inside bad cell */}
                            {!isEditing && hasDefect && (
                              <div className="mt-0.5 truncate font-sans text-[0.62rem] text-rose-300/90">
                                {cellIssues[0].reason}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {xray && (
            <div className="flex items-center justify-between text-[0.7rem] text-zinc-500 pt-1">
              <span>
                Showing {xray.rows.length} of {xray.filtered_rows} matching rows (Total in table:{" "}
                {xray.total_rows})
              </span>
              <span>Active Primary Key: {xray.primary_key_columns.join(", ") || "None"}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
