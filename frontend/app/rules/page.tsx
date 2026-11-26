"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Database,
  Layers,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
} from "lucide-react"

import { EnterpriseDataTable } from "@/components/data-table/data-table"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { SeverityBadge } from "@/components/ui-custom/severity-badge"
import { InPageRuleEditor } from "@/components/rules/in-page-rule-editor"
import { SmartInferencePanel } from "@/components/rules/smart-inference-panel"
import { api } from "@/lib/api-client"
import type {
  DatabaseSchemaResponse,
  RuleCatalogRow,
  SmartRuleInferenceResponse,
} from "@/lib/types"

export default function RulesPage() {
  const [rows, setRows] = useState<RuleCatalogRow[]>([])
  const [rawRules, setRawRules] = useState<Record<string, any>>({})
  const [schema, setSchema] = useState<DatabaseSchemaResponse | null>(null)
  const [activeTable, setActiveTable] = useState<string>("")
  const [query, setQuery] = useState("")
  const [dataset, setDataset] = useState("ALL")
  const [ruleType, setRuleType] = useState("ALL")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingBaselines, setGeneratingBaselines] = useState(false)
  const [inferringSmart, setInferringSmart] = useState(false)
  const [inferenceData, setInferenceData] = useState<SmartRuleInferenceResponse | null>(null)

  async function loadAllData() {
    setLoading(true)
    setMessage(null)
    try {
      const [catalogRows, rawRulesObj, schemaData] = await Promise.all([
        api.rules().catch(() => []),
        api.rawRules().catch(() => ({})),
        api.databaseSchema().catch(() => null),
      ])
      setRows(catalogRows)
      setRawRules(rawRulesObj)
      setSchema(schemaData)

      // Auto-select first available table if activeTable is empty
      const nonInternal = schemaData?.tables.filter((t) => !t.is_internal) ?? []
      if (nonInternal.length > 0 && !activeTable) {
        setActiveTable(nonInternal[0].name)
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to load quality rules from database.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  const datasets = Array.from(new Set(rows.map((row) => row.dataset_name).filter(Boolean))) as string[]
  const ruleTypes = Array.from(new Set(rows.map((row) => row.rule_type).filter(Boolean))) as string[]

  const filteredRows = rows.filter((row) =>
    (dataset === "ALL" || row.dataset_name === dataset) &&
    (ruleType === "ALL" || row.rule_type === ruleType) &&
    (!query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
  )

  const availableTables = schema?.tables.filter((t) => !t.is_internal) ?? []
  const configuredTableNames = Object.keys(rawRules).filter(
    (key) => !["global_rules", "cross_table_validations", "quality_thresholds"].includes(key)
  )

  const hasNoRules = configuredTableNames.length === 0

  // 1-Click Auto-Generate baseline rules for all tables in connected database
  async function handleAutoGenerateAllBaselines() {
    if (!schema || availableTables.length === 0) {
      alert("No connected database tables found to generate rules for.")
      return
    }

    setGeneratingBaselines(true)
    setMessage(null)

    try {
      const updatedRules: Record<string, any> = { ...rawRules }

      for (const table of availableTables) {
        const reqCols: string[] = []
        const nnCols: string[] = []
        const uCols: string[] = []
        const rcList: Record<string, any> = {}
        const fcList: Record<string, string> = {}
        const refList: Record<string, any> = {}

        for (const col of table.columns) {
          reqCols.push(col.name)
          if (col.is_primary_key || !col.nullable) {
            nnCols.push(col.name)
          }
          if (col.is_primary_key) {
            uCols.push(col.name)
          }

          // Numeric min: 0
          const upperType = col.data_type.toUpperCase()
          if (
            upperType.includes("INT") ||
            upperType.includes("NUMERIC") ||
            upperType.includes("DECIMAL") ||
            upperType.includes("FLOAT")
          ) {
            if (!col.is_primary_key && !col.name.endsWith("_id")) {
              rcList[col.name] = { min: 0 }
            }
          }

          // Format checks
          if (col.name.toLowerCase().includes("email")) {
            fcList[col.name] = "email"
          }
        }

        // Foreign keys from schema
        for (const fk of table.foreign_keys) {
          if (fk.constrained_columns[0] && fk.referred_table && fk.referred_columns[0]) {
            refList[fk.constrained_columns[0]] = {
              foreign_table: fk.referred_table,
              foreign_column: fk.referred_columns[0],
            }
          }
        }

        const tableConfig: Record<string, any> = {
          required_columns: reqCols,
          not_null_columns: nnCols,
          unique_columns: uCols,
        }
        if (Object.keys(rcList).length > 0) tableConfig.range_checks = rcList
        if (Object.keys(fcList).length > 0) tableConfig.format_checks = fcList
        if (Object.keys(refList).length > 0) tableConfig.referential_integrity = refList

        updatedRules[table.name] = tableConfig
      }

      await api.saveRules(updatedRules)
      setMessage({
        type: "success",
        text: `Successfully generated and saved baseline quality rules for ${availableTables.length} tables in PostgreSQL!`,
      })
      await loadAllData()
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to auto-generate baseline rules.",
      })
    } finally {
      setGeneratingBaselines(false)
    }
  }

  async function handleSmartInferRules() {
    setInferringSmart(true)
    setMessage(null)
    try {
      const res = await api.inferSmartRules()
      setInferenceData(res)
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Smart rule inference failed.",
      })
    } finally {
      setInferringSmart(false)
    }
  }

  async function handleDeleteActiveTableRules() {
    if (!activeTable) return
    if (!confirm(`Are you sure you want to delete all rules for table '${activeTable}' from PostgreSQL?`)) {
      return
    }
    try {
      await api.deleteTableRules(activeTable)
      setMessage({ type: "success", text: `Rules for table '${activeTable}' deleted from database.` })
      loadAllData()
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : `Failed to delete rules for table '${activeTable}'.`,
      })
    }
  }

  const columns = useMemo<ColumnDef<RuleCatalogRow>[]>(
    () => [
      { accessorKey: "dataset_name", header: "Table / Dataset" },
      { accessorKey: "rule_type", header: "Rule Type" },
      { accessorKey: "column_name", header: "Column" },
      { accessorKey: "severity", header: "Severity", cell: ({ row }) => <SeverityBadge severity={row.original.severity} /> },
      {
        accessorKey: "rule_config",
        header: "Config Assertion",
        cell: ({ row }) => (
          <code className="block max-w-xl whitespace-normal rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-[#B3FF4C]">
            {row.original.rule_config}
          </code>
        ),
      },
    ],
    []
  )

  return (
    <AppShell>
      <PageHeader
        eyebrow="Data Quality Management"
        title="Quality Rules Studio"
        subtitle={`Create and manage quality assertions on the main screen for database '${schema?.database ?? "my_store_db"}'.`}
        onRefresh={loadAllData}
      />

      {/* Database Context & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-[#B3FF4C]/10 border border-[#B3FF4C]/30 text-[#B3FF4C]">
            <Database className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                Database: {schema?.database ?? "my_store_db"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#B3FF4C]/10 border border-[#B3FF4C]/30 px-2 py-0.5 text-[0.65rem] font-bold text-[#B3FF4C]">
                <span className="size-1.5 rounded-full bg-[#B3FF4C]" />
                CONNECTED
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {availableTables.length} tables in database • {configuredTableNames.length} tables with active rules in PostgreSQL
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleSmartInferRules}
            disabled={inferringSmart || generatingBaselines}
            className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] text-xs gap-1.5"
          >
            <Sparkles className="size-3.5" />
            {inferringSmart ? "Scanning Live Data..." : "Smart Infer Rules (Scan Live Data)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoGenerateAllBaselines}
            disabled={generatingBaselines || inferringSmart}
            className="border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] text-xs gap-1.5"
          >
            <Wand2 className="size-3.5" />
            {generatingBaselines ? "Generating..." : "Quick Schema Starters"}
          </Button>
        </div>
      </div>

      {inferenceData ? (
        <SmartInferencePanel
          data={inferenceData}
          existingRules={rawRules}
          onClose={() => setInferenceData(null)}
          onApplied={(count) => {
            setInferenceData(null)
            setMessage({
              type: "success",
              text: `Accepted and saved ${count} data-inferred rule(s) into PostgreSQL!`,
            })
            loadAllData()
          }}
        />
      ) : null}

      {message ? (
        <div
          className={`rounded-md border p-3 text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          {message.text}
        </div>
      ) : null}

      {/* Empty State Warning if 0 rules exist in DB */}
      {hasNoRules && !loading ? (
        <Card className="rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" />
              <CardTitle className="text-sm font-semibold text-amber-300">
                No Quality Rules Configured in Database
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-200/80">
              There are currently 0 active quality rules stored in PostgreSQL (<code className="text-amber-100 font-mono">dataguard_metadata.data_quality_rules</code>). 
              Running checks now will produce an error. Use the in-page editor below to create rules or click Auto-Generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <Button
              size="sm"
              onClick={handleAutoGenerateAllBaselines}
              className="bg-amber-400 text-black font-semibold hover:bg-amber-300 text-xs gap-1.5"
            >
              <Wand2 className="size-3.5" />
              Auto-Generate Starter Rules (1-Click)
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <EnterpriseMetricCard
          title="Total Active Rules"
          value={rows.length}
          description="Assertions in dataguard_metadata"
          icon={SlidersHorizontal}
          tone="green"
        />
        <EnterpriseMetricCard
          title="Tables Monitored"
          value={configuredTableNames.length}
          description={`of ${availableTables.length} tables in DB`}
          icon={Database}
          tone="blue"
        />
        <EnterpriseMetricCard
          title="Rule Types Active"
          value={ruleTypes.length}
          description="Validation categories"
          icon={Columns3}
          tone="slate"
        />
        <EnterpriseMetricCard
          title="Unconfigured Tables"
          value={Math.max(0, availableTables.length - configuredTableNames.length)}
          description="Tables without rules"
          icon={AlertTriangle}
          tone="amber"
        />
      </div>

      {/* MAIN SCREEN RULE CREATOR & STUDIO */}
      <div className="space-y-4">
        {/* Table Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">
              Select Table:
            </span>
            {availableTables.map((t) => {
              const hasConfig = Boolean(rawRules[t.name] && Object.keys(rawRules[t.name]).length > 0)
              const isCurrent = activeTable === t.name

              return (
                <button
                  key={t.name}
                  onClick={() => setActiveTable(t.name)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    isCurrent
                      ? "bg-[#B3FF4C] text-black font-semibold shadow"
                      : "bg-[#141414] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <Layers className="size-3" />
                  <span>{t.name}</span>
                  <span
                    className={`text-[0.62rem] px-1 py-0.2 rounded ${
                      isCurrent
                        ? "bg-black/20 text-black"
                        : hasConfig
                        ? "bg-[#B3FF4C]/20 text-[#B3FF4C]"
                        : "bg-white/10 text-zinc-400"
                    }`}
                  >
                    {hasConfig ? "Rules Active" : "No rules"}
                  </span>
                </button>
              )
            })}

            {/* View Full Catalog Tab */}
            <button
              onClick={() => setActiveTable("__CATALOG__")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ml-2 ${
                activeTable === "__CATALOG__"
                  ? "bg-white/20 text-white font-semibold"
                  : "bg-[#141414] border border-white/[0.08] text-zinc-400 hover:text-white"
              }`}
            >
              <Table2 className="size-3" />
              <span>All Rules Table</span>
            </button>

            {/* View JSON Tab */}
            <button
              onClick={() => setActiveTable("__JSON__")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTable === "__JSON__"
                  ? "bg-white/20 text-white font-semibold"
                  : "bg-[#141414] border border-white/[0.08] text-zinc-400 hover:text-white"
              }`}
            >
              <span>Database JSON</span>
            </button>
          </div>

          {activeTable && activeTable !== "__CATALOG__" && activeTable !== "__JSON__" && rawRules[activeTable] ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteActiveTableRules}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 gap-1"
            >
              <Trash2 className="size-3" />
              Delete Rules for {activeTable}
            </Button>
          ) : null}
        </div>

        {/* MAIN SCREEN VIEW CONTENT */}
        {activeTable === "__CATALOG__" ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-3.5 md:grid-cols-3">
              <input
                className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-[#B3FF4C]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search active rules"
              />
              <select
                className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]"
                value={dataset}
                onChange={(event) => setDataset(event.target.value)}
              >
                <option value="ALL">All tables</option>
                {datasets.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]"
                value={ruleType}
                onChange={(event) => setRuleType(event.target.value)}
              >
                <option value="ALL">All rule types</option>
                {ruleTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <EnterpriseDataTable columns={columns} data={filteredRows} loading={loading} />
          </div>
        ) : activeTable === "__JSON__" ? (
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Database Rules: {schema?.database ?? "my_store_db"}</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Direct JSON representation stored in PostgreSQL table <code className="text-[#B3FF4C]">dataguard_metadata.data_quality_rules</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[560px] overflow-auto rounded-md border border-white/[0.08] bg-[#0c0c0c] p-4 text-xs font-mono text-[#B3FF4C]">
                {JSON.stringify(rawRules, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : activeTable ? (
          /* IN-PAGE MAIN SCREEN RULE EDITOR FOR ACTIVE TABLE */
          <InPageRuleEditor
            tableName={activeTable}
            schema={schema}
            existingRules={rawRules}
            onSaveSuccess={loadAllData}
          />
        ) : (
          <div className="py-12 text-center text-xs text-zinc-500">
            Select a table above to configure quality rules.
          </div>
        )}
      </div>
    </AppShell>
  )
}
