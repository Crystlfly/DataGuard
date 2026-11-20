"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, Binary, Database, Fingerprint, Percent } from "lucide-react"

import { EnterpriseDataTable } from "@/components/data-table/data-table"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { api } from "@/lib/api-client"
import { formatNumber, formatPercent } from "@/lib/formatters"
import type { ProfileResult } from "@/lib/types"

export default function ProfilingPage() {
  const [rows, setRows] = useState<ProfileResult[]>([])
  const [dataset, setDataset] = useState("ALL")
  const [column, setColumn] = useState("ALL")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)

  async function loadProfiles() {
    setLoading(true)
    setMessage("")
    try {
      setRows(await api.profiling())
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load profiles.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const datasets = Array.from(new Set(rows.map((row) => row.dataset_name).filter(Boolean))) as string[]
  const filteredRows = rows.filter((row) => (dataset === "ALL" || row.dataset_name === dataset) && (column === "ALL" || row.column_name === column))
  const columnsForDataset = Array.from(new Set(rows.filter((row) => dataset === "ALL" || row.dataset_name === dataset).map((row) => row.column_name).filter(Boolean))) as string[]
  const avgNullRate = filteredRows.length ? filteredRows.reduce((total, row) => total + Number(row.null_rate ?? 0), 0) / filteredRows.length : 0
  const dataTypes = Array.from(new Set(filteredRows.map((row) => row.data_type).filter(Boolean)))
  const nullChart = filteredRows.slice(0, 12).map((row) => ({ column: row.column_name, null_rate: Number(row.null_rate ?? 0) }))
  const uniqueChart = filteredRows.slice(0, 12).map((row) => ({ column: row.column_name, unique_count: Number(row.unique_count ?? 0) }))
  const typeChart = dataTypes.map((type) => ({ type, count: filteredRows.filter((row) => row.data_type === type).length }))
  const recommendations = filteredRows.filter((row) => Number(row.null_rate ?? 0) > 20 || Number(row.unique_count ?? 0) <= 1).slice(0, 6)

  const tableColumns = useMemo<ColumnDef<ProfileResult>[]>(
    () => [
      { accessorKey: "dataset_name", header: "Dataset" },
      { accessorKey: "column_name", header: "Column" },
      { accessorKey: "data_type", header: "Data Type" },
      { accessorKey: "total_rows", header: "Rows", cell: ({ row }) => formatNumber(row.original.total_rows) },
      { accessorKey: "null_rate", header: "Null Rate", cell: ({ row }) => formatPercent(row.original.null_rate) },
      { accessorKey: "unique_count", header: "Unique", cell: ({ row }) => formatNumber(row.original.unique_count) },
      { accessorKey: "duplicate_count", header: "Duplicates", cell: ({ row }) => formatNumber(row.original.duplicate_count) },
      { accessorKey: "min_value", header: "Min" },
      { accessorKey: "max_value", header: "Max" },
      { accessorKey: "mean", header: "Mean", cell: ({ row }) => formatNumber(row.original.mean) },
    ],
    []
  )

  function BarCard({ title, description, data, dataKey, xKey }: { title: string; description: string; data: Record<string, unknown>[]; dataKey: string; xKey: string }) {
    return (
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">{title}</CardTitle>
          <CardDescription className="text-xs text-zinc-400">{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#141414", borderColor: "rgba(255, 255, 255, 0.1)", borderRadius: "6px", color: "#fff", fontSize: "12px" }} />
              <Bar dataKey={dataKey} fill="#B3FF4C" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Profiling"
        title="Data Profiling Workbench"
        subtitle="Explore column-level completeness, uniqueness, types, and numeric statistics."
        onRefresh={loadProfiles}
      />

      {message ? <Card className="rounded-md border-[#B3FF4C]/30 bg-[#B3FF4C]/10"><CardContent className="p-3 text-xs text-[#B3FF4C]">{message}</CardContent></Card> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <EnterpriseMetricCard title="Profile Rows" value={filteredRows.length} description="Current view" icon={Database} tone="blue" />
        <EnterpriseMetricCard title="Average Null Rate" value={formatPercent(avgNullRate)} description="Across columns" icon={Percent} tone="amber" />
        <EnterpriseMetricCard title="Data Types" value={dataTypes.length} description="Distinct types" icon={Binary} tone="slate" />
        <EnterpriseMetricCard title="Recommendations" value={recommendations.length} description="Potential rules" icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-3.5 md:grid-cols-2">
        <select className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]" value={dataset} onChange={(event) => { setDataset(event.target.value); setColumn("ALL") }}>
          <option value="ALL">All datasets</option>
          {datasets.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]" value={column} onChange={(event) => setColumn(event.target.value)}>
          <option value="ALL">All columns</option>
          {columnsForDataset.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Dataset Overview</TabsTrigger>
          <TabsTrigger value="columns">Column Explorer</TabsTrigger>
          <TabsTrigger value="missingness">Missingness</TabsTrigger>
          <TabsTrigger value="uniqueness">Uniqueness</TabsTrigger>
          <TabsTrigger value="numeric">Numeric Statistics</TabsTrigger>
          <TabsTrigger value="categorical">Categorical Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5 grid gap-6 xl:grid-cols-3">
          <BarCard title="Null Rate by Column" description="Columns with missingness." data={nullChart} dataKey="null_rate" xKey="column" />
          <BarCard title="Unique Count by Column" description="Cardinality by selected dataset." data={uniqueChart} dataKey="unique_count" xKey="column" />
          <BarCard title="Data Type Distribution" description="Profiled column type mix." data={typeChart} dataKey="count" xKey="type" />
        </TabsContent>
        <TabsContent value="columns" className="mt-5">
          <EnterpriseDataTable columns={tableColumns} data={filteredRows} loading={loading} />
        </TabsContent>
        <TabsContent value="missingness" className="mt-5">
          <BarCard title="Missingness" description="Null rate percentage by column." data={nullChart} dataKey="null_rate" xKey="column" />
        </TabsContent>
        <TabsContent value="uniqueness" className="mt-5">
          <BarCard title="Uniqueness" description="Unique value count by column." data={uniqueChart} dataKey="unique_count" xKey="column" />
        </TabsContent>
        <TabsContent value="numeric" className="mt-5">
          <EnterpriseDataTable columns={tableColumns} data={filteredRows.filter((row) => row.mean !== null && row.mean !== undefined)} loading={loading} />
        </TabsContent>
        <TabsContent value="categorical" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((row) => (
              <Card className="rounded-md border border-white/[0.08] bg-[#141414]" key={`${row.dataset_name}-${row.column_name}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Fingerprint className="size-4" /> Rule Recommendation</CardTitle>
                  <CardDescription>{row.dataset_name}.{row.column_name}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-zinc-300">
                  {Number(row.null_rate ?? 0) > 20 ? "Consider a not-null or completeness rule." : "Consider uniqueness or categorical validation."}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}

