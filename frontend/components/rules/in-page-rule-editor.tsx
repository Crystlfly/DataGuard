"use client"

import { useEffect, useState } from "react"
import {
  Check,
  Layers,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api-client"
import type { DatabaseSchemaResponse, TableRuleConfig, TableSchema } from "@/lib/types"

interface InPageRuleEditorProps {
  tableName: string
  schema: DatabaseSchemaResponse | null
  existingRules: Record<string, any>
  onSaveSuccess: () => void
}

export function InPageRuleEditor({
  tableName,
  schema,
  existingRules,
  onSaveSuccess,
}: InPageRuleEditorProps) {
  const tables = schema?.tables.filter((t) => !t.is_internal) ?? []
  const currentTableSchema = tables.find((t) => t.name === tableName)
  const currentColumns = currentTableSchema?.columns ?? []

  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Current table config state
  const [requiredColumns, setRequiredColumns] = useState<string[]>([])
  const [notNullColumns, setNotNullColumns] = useState<string[]>([])
  const [uniqueColumns, setUniqueColumns] = useState<string[]>([])

  // Advanced checks state
  const [rangeChecks, setRangeChecks] = useState<
    Array<{
      column: string
      min?: string
      max?: string
      min_length?: string
      max_length?: string
    }>
  >([])

  const [formatChecks, setFormatChecks] = useState<Array<{ column: string; format: string }>>([])

  const [categoricalChecks, setCategoricalChecks] = useState<
    Array<{ column: string; valuesText: string }>
  >([])

  const [referentialChecks, setReferentialChecks] = useState<
    Array<{
      column: string
      foreignTable: string
      foreignColumn: string
    }>
  >([])

  // Load existing rules for the active table
  useEffect(() => {
    if (!tableName) return

    const cfg = existingRules[tableName] as TableRuleConfig | undefined

    setRequiredColumns(cfg?.required_columns || [])
    setNotNullColumns(cfg?.not_null_columns || [])
    setUniqueColumns(cfg?.unique_columns || [])

    // Range checks
    const rcList: typeof rangeChecks = []
    if (cfg?.range_checks) {
      for (const [col, r] of Object.entries(cfg.range_checks)) {
        rcList.push({
          column: col,
          min: r.min !== undefined ? String(r.min) : "",
          max: r.max !== undefined ? String(r.max) : "",
          min_length: r.min_length !== undefined ? String(r.min_length) : "",
          max_length: r.max_length !== undefined ? String(r.max_length) : "",
        })
      }
    }
    setRangeChecks(rcList)

    // Format checks
    const fcList: typeof formatChecks = []
    if (cfg?.format_checks) {
      for (const [col, fmt] of Object.entries(cfg.format_checks)) {
        fcList.push({ column: col, format: fmt })
      }
    }
    setFormatChecks(fcList)

    // Categorical checks
    const ccList: typeof categoricalChecks = []
    if (cfg?.categorical_checks) {
      for (const [col, c] of Object.entries(cfg.categorical_checks)) {
        ccList.push({
          column: col,
          valuesText: (c.allowed_values || []).join(", "),
        })
      }
    }
    setCategoricalChecks(ccList)

    // Referential checks
    const refList: typeof referentialChecks = []
    if (cfg?.referential_integrity) {
      for (const [col, ref] of Object.entries(cfg.referential_integrity)) {
        refList.push({
          column: col,
          foreignTable: ref.foreign_table,
          foreignColumn: ref.foreign_column,
        })
      }
    }
    setReferentialChecks(refList)
    setStatusMessage(null)
  }, [tableName, existingRules])

  function toggleColumnInList(list: string[], setList: (l: string[]) => void, colName: string) {
    if (list.includes(colName)) {
      setList(list.filter((c) => c !== colName))
    } else {
      setList([...list, colName])
    }
  }

  // Pre-fill sensible starter defaults based on schema inspection
  function handleAutoFill() {
    if (!currentTableSchema) return

    const reqCols: string[] = []
    const nnCols: string[] = []
    const uCols: string[] = []
    const rcList: typeof rangeChecks = []
    const fcList: typeof formatChecks = []
    const refList: typeof referentialChecks = []

    for (const col of currentTableSchema.columns) {
      reqCols.push(col.name)
      if (col.is_primary_key || !col.nullable) {
        nnCols.push(col.name)
      }
      if (col.is_primary_key) {
        uCols.push(col.name)
      }

      // Check numeric types for min: 0
      const upperType = col.data_type.toUpperCase()
      if (
        upperType.includes("INT") ||
        upperType.includes("NUMERIC") ||
        upperType.includes("DECIMAL") ||
        upperType.includes("FLOAT")
      ) {
        if (!col.is_primary_key && !col.name.endsWith("_id")) {
          rcList.push({ column: col.name, min: "0" })
        }
      }

      // Format check for email
      if (col.name.toLowerCase().includes("email")) {
        fcList.push({ column: col.name, format: "email" })
      }
    }

    // Auto-fill foreign keys from schema
    for (const fk of currentTableSchema.foreign_keys) {
      if (fk.constrained_columns[0] && fk.referred_table && fk.referred_columns[0]) {
        refList.push({
          column: fk.constrained_columns[0],
          foreignTable: fk.referred_table,
          foreignColumn: fk.referred_columns[0],
        })
      }
    }

    setRequiredColumns(reqCols)
    setNotNullColumns(nnCols)
    setUniqueColumns(uCols)
    setRangeChecks(rcList)
    setFormatChecks(fcList)
    setReferentialChecks(refList)

    setStatusMessage({
      type: "success",
      text: "Pre-filled recommended starter rules for this table!",
    })
  }

  async function handleSave() {
    if (!tableName) return
    setSaving(true)
    setStatusMessage(null)

    const tableConfig: Record<string, any> = {}

    if (requiredColumns.length > 0) {
      tableConfig.required_columns = requiredColumns
    }
    if (uniqueColumns.length > 0) {
      tableConfig.unique_columns = uniqueColumns
    }
    if (notNullColumns.length > 0) {
      tableConfig.not_null_columns = notNullColumns
    }

    // Range checks
    if (rangeChecks.length > 0) {
      const rcObj: Record<string, any> = {}
      for (const rc of rangeChecks) {
        if (!rc.column) continue
        const item: Record<string, any> = {}
        if (rc.min !== undefined && rc.min !== "") item.min = Number(rc.min)
        if (rc.max !== undefined && rc.max !== "") item.max = Number(rc.max)
        if (rc.min_length !== undefined && rc.min_length !== "") item.min_length = Number(rc.min_length)
        if (rc.max_length !== undefined && rc.max_length !== "") item.max_length = Number(rc.max_length)
        if (Object.keys(item).length > 0) {
          rcObj[rc.column] = item
        }
      }
      if (Object.keys(rcObj).length > 0) {
        tableConfig.range_checks = rcObj
      }
    }

    // Format checks
    if (formatChecks.length > 0) {
      const fcObj: Record<string, string> = {}
      for (const fc of formatChecks) {
        if (fc.column && fc.format) {
          fcObj[fc.column] = fc.format
        }
      }
      if (Object.keys(fcObj).length > 0) {
        tableConfig.format_checks = fcObj
      }
    }

    // Categorical checks
    if (categoricalChecks.length > 0) {
      const ccObj: Record<string, any> = {}
      for (const cc of categoricalChecks) {
        if (!cc.column || !cc.valuesText.trim()) continue
        const values = cc.valuesText
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
        if (values.length > 0) {
          ccObj[cc.column] = { allowed_values: values }
        }
      }
      if (Object.keys(ccObj).length > 0) {
        tableConfig.categorical_checks = ccObj
      }
    }

    // Referential checks
    if (referentialChecks.length > 0) {
      const refObj: Record<string, any> = {}
      for (const ref of referentialChecks) {
        if (ref.column && ref.foreignTable && ref.foreignColumn) {
          refObj[ref.column] = {
            foreign_table: ref.foreignTable,
            foreign_column: ref.foreignColumn,
          }
        }
      }
      if (Object.keys(refObj).length > 0) {
        tableConfig.referential_integrity = refObj
      }
    }

    try {
      await api.saveTableRules(tableName, tableConfig)
      setStatusMessage({
        type: "success",
        text: `Quality rules for table '${tableName}' saved to database successfully!`,
      })
      onSaveSuccess()
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save table rules.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Table Editor Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-md border border-white/[0.08] bg-[#141414]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-[#B3FF4C]/10 border border-[#B3FF4C]/30 text-[#B3FF4C]">
            <Layers className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Table: {tableName}</span>
              <span className="text-xs text-zinc-400 font-mono">
                ({currentTableSchema?.row_count ?? 0} rows • {currentColumns.length} columns)
              </span>
            </div>
            <p className="text-[0.7rem] text-zinc-400 mt-0.5">
              Check the assertions below to validate this table during monitoring runs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoFill}
            className="border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C] hover:bg-[#B3FF4C]/20 text-xs gap-1.5 h-8"
          >
            <Wand2 className="size-3.5" />
            Auto-Fill Table Starter Rules
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] text-xs h-8 px-4"
          >
            {saving ? "Saving..." : `Save Rules for ${tableName}`}
          </Button>
        </div>
      </div>

      {statusMessage ? (
        <div
          className={`rounded-md border p-3 text-xs flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {statusMessage.type === "success" ? <Check className="size-4" /> : null}
          {statusMessage.text}
        </div>
      ) : null}

      {/* Tabs on the Main Screen */}
      <Tabs defaultValue="columns">
        <TabsList className="bg-[#141414] border border-white/[0.08]">
          <TabsTrigger value="columns">1. Column Checklists</TabsTrigger>
          <TabsTrigger value="ranges">2. Range & Length Checks</TabsTrigger>
          <TabsTrigger value="formats">3. Formats</TabsTrigger>
          <TabsTrigger value="categories">4. Categories</TabsTrigger>
          <TabsTrigger value="foreignKeys">5. Foreign Keys</TabsTrigger>
        </TabsList>

        {/* TAB 1: Column Checklists */}
        <TabsContent value="columns" className="mt-3">
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Column-Level Assertions for {tableName}
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Tick the assertions you want DataGuard to verify on each column during runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-zinc-400 bg-white/[0.02]">
                      <th className="py-2.5 px-4 text-left font-medium">Column Name</th>
                      <th className="py-2.5 px-3 text-left font-medium">SQL Data Type</th>
                      <th className="py-2.5 px-3 text-center font-medium">
                        <span title="Column must exist in schema">Required Column</span>
                      </th>
                      <th className="py-2.5 px-3 text-center font-medium">
                        <span title="Values cannot be NULL / empty">Not Null</span>
                      </th>
                      <th className="py-2.5 px-3 text-center font-medium">
                        <span title="Values must be distinct (no duplicates)">Unique</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {currentColumns.map((col) => (
                      <tr key={col.name} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 font-mono font-medium text-white flex items-center gap-1.5">
                          {col.name}
                          {col.is_primary_key ? (
                            <span className="rounded bg-[#B3FF4C]/20 px-1 py-0.2 text-[0.6rem] font-bold text-[#B3FF4C]">
                              PK
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400">{col.data_type}</td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={requiredColumns.includes(col.name)}
                            onChange={() => toggleColumnInList(requiredColumns, setRequiredColumns, col.name)}
                            className="size-4 rounded accent-[#B3FF4C] cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={notNullColumns.includes(col.name)}
                            onChange={() => toggleColumnInList(notNullColumns, setNotNullColumns, col.name)}
                            className="size-4 rounded accent-[#B3FF4C] cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={uniqueColumns.includes(col.name)}
                            onChange={() => toggleColumnInList(uniqueColumns, setUniqueColumns, col.name)}
                            className="size-4 rounded accent-[#B3FF4C] cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Range & Length Checks */}
        <TabsContent value="ranges" className="mt-3">
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Range & Length Limits
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Validate minimum and maximum bounds for numeric values or string lengths.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setRangeChecks([
                    ...rangeChecks,
                    { column: currentColumns[0]?.name ?? "" },
                  ])
                }
                className="border-white/10 text-xs gap-1"
              >
                <Plus className="size-3" /> Add Range Check
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rangeChecks.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3">No range checks defined for {tableName}. Click above to add one.</p>
              ) : (
                rangeChecks.map((rc, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center p-3 rounded-md bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Column</Label>
                      <select
                        value={rc.column}
                        onChange={(e) => {
                          const updated = [...rangeChecks]
                          updated[idx].column = e.target.value
                          setRangeChecks(updated)
                        }}
                        className="w-full mt-1 rounded border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white"
                      >
                        {currentColumns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Min Number</Label>
                      <Input
                        placeholder="e.g. 0"
                        value={rc.min ?? ""}
                        onChange={(e) => {
                          const updated = [...rangeChecks]
                          updated[idx].min = e.target.value
                          setRangeChecks(updated)
                        }}
                        className="mt-1 h-7 text-xs bg-[#141414] border-white/10"
                      />
                    </div>
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Max Number</Label>
                      <Input
                        placeholder="e.g. 100000"
                        value={rc.max ?? ""}
                        onChange={(e) => {
                          const updated = [...rangeChecks]
                          updated[idx].max = e.target.value
                          setRangeChecks(updated)
                        }}
                        className="mt-1 h-7 text-xs bg-[#141414] border-white/10"
                      />
                    </div>
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Min Text Length</Label>
                      <Input
                        placeholder="e.g. 2"
                        value={rc.min_length ?? ""}
                        onChange={(e) => {
                          const updated = [...rangeChecks]
                          updated[idx].min_length = e.target.value
                          setRangeChecks(updated)
                        }}
                        className="mt-1 h-7 text-xs bg-[#141414] border-white/10"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex-1">
                        <Label className="text-[0.68rem] text-zinc-400">Max Text Length</Label>
                        <Input
                          placeholder="e.g. 100"
                          value={rc.max_length ?? ""}
                          onChange={(e) => {
                            const updated = [...rangeChecks]
                            updated[idx].max_length = e.target.value
                            setRangeChecks(updated)
                          }}
                          className="mt-1 h-7 text-xs bg-[#141414] border-white/10"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRangeChecks(rangeChecks.filter((_, i) => i !== idx))}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Formats */}
        <TabsContent value="formats" className="mt-3">
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Format Patterns
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Verify syntax compliance for email addresses, names, or UUIDs.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormatChecks([
                    ...formatChecks,
                    { column: currentColumns[0]?.name ?? "", format: "email" },
                  ])
                }
                className="border-white/10 text-xs gap-1"
              >
                <Plus className="size-3" /> Add Format Check
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {formatChecks.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3">No format rules defined for {tableName}.</p>
              ) : (
                formatChecks.map((fc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-md bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div className="flex-1">
                      <Label className="text-[0.68rem] text-zinc-400">Column</Label>
                      <select
                        value={fc.column}
                        onChange={(e) => {
                          const updated = [...formatChecks]
                          updated[idx].column = e.target.value
                          setFormatChecks(updated)
                        }}
                        className="w-full mt-1 rounded border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white"
                      >
                        {currentColumns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-[0.68rem] text-zinc-400">Format Standard</Label>
                      <select
                        value={fc.format}
                        onChange={(e) => {
                          const updated = [...formatChecks]
                          updated[idx].format = e.target.value
                          setFormatChecks(updated)
                        }}
                        className="w-full mt-1 rounded border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white"
                      >
                        <option value="email">email (Valid address with @)</option>
                        <option value="alpha_with_spaces">alpha_with_spaces (Letters only)</option>
                        <option value="alphanumeric">alphanumeric (Letters & digits)</option>
                        <option value="uuid">uuid (Standard UUID string)</option>
                        <option value="iso_date">iso_date (YYYY-MM-DD)</option>
                      </select>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormatChecks(formatChecks.filter((_, i) => i !== idx))}
                      className="h-8 w-8 mt-4 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Categories */}
        <TabsContent value="categories" className="mt-3">
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Categorical Allowed Values
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Ensure column values match a strict list of allowed values.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCategoricalChecks([
                    ...categoricalChecks,
                    { column: currentColumns[0]?.name ?? "", valuesText: "" },
                  ])
                }
                className="border-white/10 text-xs gap-1"
              >
                <Plus className="size-3" /> Add Category Check
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoricalChecks.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3">No categorical rules defined for {tableName}.</p>
              ) : (
                categoricalChecks.map((cc, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col md:flex-row items-start md:items-center gap-3 p-3 rounded-md bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div className="w-full md:w-1/3">
                      <Label className="text-[0.68rem] text-zinc-400">Column</Label>
                      <select
                        value={cc.column}
                        onChange={(e) => {
                          const updated = [...categoricalChecks]
                          updated[idx].column = e.target.value
                          setCategoricalChecks(updated)
                        }}
                        className="w-full mt-1 rounded border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white"
                      >
                        {currentColumns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 w-full">
                      <Label className="text-[0.68rem] text-zinc-400">Allowed Values (comma-separated)</Label>
                      <Input
                        placeholder="pending, processing, shipped, delivered, cancelled"
                        value={cc.valuesText}
                        onChange={(e) => {
                          const updated = [...categoricalChecks]
                          updated[idx].valuesText = e.target.value
                          setCategoricalChecks(updated)
                        }}
                        className="mt-1 h-7 text-xs bg-[#141414] border-white/10"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCategoricalChecks(categoricalChecks.filter((_, i) => i !== idx))
                      }
                      className="h-8 w-8 md:mt-4 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 self-end"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Foreign Keys */}
        <TabsContent value="foreignKeys" className="mt-3">
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Referential Integrity (Foreign Keys)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Verify that foreign keys always point to valid rows in another table.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setReferentialChecks([
                    ...referentialChecks,
                    {
                      column: currentColumns[0]?.name ?? "",
                      foreignTable: tables.find((t) => t.name !== tableName)?.name ?? "",
                      foreignColumn: "id",
                    },
                  ])
                }
                className="border-white/10 text-xs gap-1"
              >
                <Plus className="size-3" /> Add Foreign Key Check
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {referentialChecks.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3">No referential integrity rules defined for {tableName}.</p>
              ) : (
                referentialChecks.map((ref, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center p-3 rounded-md bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Source Column</Label>
                      <select
                        value={ref.column}
                        onChange={(e) => {
                          const updated = [...referentialChecks]
                          updated[idx].column = e.target.value
                          setReferentialChecks(updated)
                        }}
                        className="w-full mt-1 rounded border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white"
                      >
                        {currentColumns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Target Table</Label>
                      <select
                        value={ref.foreignTable}
                        onChange={(e) => {
                          const updated = [...referentialChecks]
                          updated[idx].foreignTable = e.target.value
                          setReferentialChecks(updated)
                        }}
                        className="w-full mt-1 rounded border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white"
                      >
                        {tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[0.68rem] text-zinc-400">Target Column</Label>
                      <Input
                        placeholder="id"
                        value={ref.foreignColumn}
                        onChange={(e) => {
                          const updated = [...referentialChecks]
                          updated[idx].foreignColumn = e.target.value
                          setReferentialChecks(updated)
                        }}
                        className="mt-1 h-7 text-xs bg-[#141414] border-white/10"
                      />
                    </div>
                    <div className="flex justify-end items-end h-full">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setReferentialChecks(referentialChecks.filter((_, i) => i !== idx))
                        }
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-between p-3.5 rounded-md border border-white/[0.08] bg-[#141414]">
        <p className="text-xs text-zinc-400">
          Ready to apply rules to <code className="text-[#B3FF4C]">{tableName}</code> in the database.
        </p>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] text-xs px-5 h-8"
        >
          {saving ? "Saving Rules to DB..." : `Save Rules for ${tableName}`}
        </Button>
      </div>
    </div>
  )
}
