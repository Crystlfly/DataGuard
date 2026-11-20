"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowRight, GitBranch, Network, Table2 } from "lucide-react"

import { EnterpriseDataTable } from "@/components/data-table/data-table"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { api } from "@/lib/api-client"
import type { CheckResult, LineageEdge } from "@/lib/types"

export default function LineagePage() {
  const [rows, setRows] = useState<LineageEdge[]>([])
  const [results, setResults] = useState<CheckResult[]>([])
  const [dataset, setDataset] = useState("ALL")
  const [relationship, setRelationship] = useState("ALL")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    setMessage("")
    try {
      const [lineageRows, resultRows] = await Promise.all([api.lineage(), api.results().catch(() => [])])
      setRows(lineageRows)
      setResults(resultRows)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load lineage.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const tables = Array.from(new Set(rows.flatMap((row) => [row.source_table, row.target_table]).filter(Boolean))) as string[]
  const relationshipTypes = Array.from(new Set(rows.map((row) => row.relationship_type).filter(Boolean))) as string[]
  const filteredRows = rows.filter((row) =>
    (dataset === "ALL" || row.source_table === dataset || row.target_table === dataset) &&
    (relationship === "ALL" || row.relationship_type === relationship)
  )
  const failedLineageChecks = results.filter((row) =>
    row.status === "FAIL" && filteredRows.some((edge) => edge.source_table === row.dataset_name || edge.target_table === row.dataset_name)
  )

  const columns = useMemo<ColumnDef<LineageEdge>[]>(
    () => [
      { accessorKey: "source_table", header: "Source Table" },
      { accessorKey: "source_column", header: "Source Column" },
      { accessorKey: "target_table", header: "Target Table" },
      { accessorKey: "target_column", header: "Target Column" },
      { accessorKey: "relationship_type", header: "Type" },
      { accessorKey: "description", header: "Description" },
    ],
    []
  )

  return (
    <AppShell>
      <PageHeader
        eyebrow="Governance"
        title="Data Lineage"
        subtitle="Understand upstream and downstream table relationships and the quality impact of failing checks."
        onRefresh={loadData}
      />

      {message ? <Card className="rounded-md border-[#B3FF4C]/30 bg-[#B3FF4C]/10"><CardContent className="p-3 text-xs text-[#B3FF4C]">{message}</CardContent></Card> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <EnterpriseMetricCard title="Lineage Edges" value={rows.length} description="Persisted relationships" icon={GitBranch} tone="blue" />
        <EnterpriseMetricCard title="Tables" value={tables.length} description="Upstream and downstream" icon={Table2} tone="green" />
        <EnterpriseMetricCard title="Impacted Failures" value={failedLineageChecks.length} description="Failed checks mapped to lineage" icon={Network} tone="red" />
      </div>

      <div className="grid gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-3.5 md:grid-cols-3">
        <select className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]" value={dataset} onChange={(event) => setDataset(event.target.value)}>
          <option value="ALL">All datasets</option>
          {tables.map((table) => <option key={table} value={table}>{table}</option>)}
        </select>
        <select className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]" value={relationship} onChange={(event) => setRelationship(event.target.value)}>
          <option value="ALL">All relationships</option>
          {relationshipTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table Lineage</TabsTrigger>
          <TabsTrigger value="column">Column Lineage</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="mt-5">
          <div className="grid gap-3">
            {filteredRows.slice(0, 8).map((edge, index) => (
              <div className="grid items-center gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-3.5 md:grid-cols-[1fr_auto_1fr]" key={`${edge.source_table}-${edge.target_table}-${index}`}>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-zinc-400">Source</div>
                  <div className="mt-1 text-sm font-semibold text-white">{edge.source_table}</div>
                  <div className="text-xs text-zinc-400">{edge.source_column}</div>
                </div>
                <ArrowRight className="mx-auto size-4 text-[#B3FF4C]" />
                <div className="rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 p-3">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-[#B3FF4C]">Target</div>
                  <div className="mt-1 text-sm font-semibold text-white">{edge.target_table}</div>
                  <div className="text-xs text-zinc-300">{edge.target_column}</div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="column" className="mt-5">
          <EnterpriseDataTable columns={columns} data={filteredRows} loading={loading} />
        </TabsContent>
        <TabsContent value="impact" className="mt-5">
          <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Failed Checks Related to Lineage</CardTitle>
              <CardDescription className="text-xs text-zinc-400">Quality failures connected to upstream or downstream relationships.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {failedLineageChecks.slice(0, 12).map((row) => (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-xs" key={row.id}>
                  <div className="font-medium text-white">{row.dataset_name}</div>
                  <p className="mt-1 text-xs text-zinc-400">{row.check_type} on {row.column_name ?? row.column ?? "table"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}

