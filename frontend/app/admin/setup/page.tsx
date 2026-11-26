"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  HardDrive,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Table2,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui-custom/page-header"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type {
  DatabaseConnectionPayload,
  DatabaseStatusResponse,
  DatabaseTestResponse,
  TableSummary,
} from "@/lib/types"

const PROVIDERS = [
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "Relational & Cloud DB",
    defaultPort: 5432,
    badge: "Recommended",
    description: "Connect to self-hosted, AWS RDS, Supabase, Neon, or GCP Cloud SQL.",
  },
]

export default function SetupPage() {
  // Active Database Status
  const [dbStatus, setDbStatus] = useState<DatabaseStatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // Connection Form State
  const [selectedProvider, setSelectedProvider] = useState<string>("postgres")
  const [connectionMode, setConnectionMode] = useState<"params" | "uri">("params")
  const [host, setHost] = useState("localhost")
  const [port, setPort] = useState("5432")
  const [database, setDatabase] = useState("my_store_db")
  const [username, setUsername] = useState("postgres")
  const [password, setPassword] = useState("")
  const [sslMode, setSslMode] = useState("prefer")
  const [connectionUri, setConnectionUri] = useState("")

  // Test & Connect Actions
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [testResult, setTestResult] = useState<DatabaseTestResponse | null>(null)
  const [actionMessage, setActionMessage] = useState("")

  const [lastChecked, setLastChecked] = useState("")
  const [runningChecks, setRunningChecks] = useState(false)

  async function loadDatabaseStatus() {
    setLoadingStatus(true)
    try {
      const status = await api.databaseStatus()
      setDbStatus(status)
      if (status.source_type) {
        setSelectedProvider(status.source_type)
      }
      if (status.host) setHost(status.host)
      if (status.port) setPort(String(status.port))
      if (status.database) setDatabase(status.database)
      if (status.username) setUsername(status.username)
      if (status.last_verified) {
        setLastChecked(formatDateTime(status.last_verified))
      } else {
        setLastChecked(formatDateTime(new Date()))
      }
    } catch (err) {
      console.error("Failed to load active database status:", err)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    loadDatabaseStatus()
  }, [])

  function handleSelectProvider(providerId: string) {
    setSelectedProvider(providerId)
    const p = PROVIDERS.find((item) => item.id === providerId)
    if (p) {
      setPort(String(p.defaultPort))
    }
    setTestResult(null)
  }

  function fillLocalDefaults() {
    setSelectedProvider("postgres")
    setConnectionMode("params")
    setHost("localhost")
    setPort("5432")
    setDatabase("my_store_db")
    setUsername("postgres")
    setPassword("postgres")
    setSslMode("prefer")
    setTestResult(null)
    setActionMessage("Filled local development PostgreSQL settings.")
  }

  function getPayload(): DatabaseConnectionPayload {
    return {
      source_type: selectedProvider,
      connection_mode: connectionMode,
      connection_uri: connectionMode === "uri" ? connectionUri : undefined,
      host: connectionMode === "params" ? host : undefined,
      port: connectionMode === "params" ? Number(port) || 5432 : undefined,
      database: connectionMode === "params" ? database : undefined,
      username: connectionMode === "params" ? username : undefined,
      password: connectionMode === "params" ? password : undefined,
      ssl_mode: connectionMode === "params" ? sslMode : undefined,
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setActionMessage("")
    setTestResult(null)
    try {
      const result = await api.testDatabaseConnection(getPayload())
      setTestResult(result)
      if (result.success) {
        setActionMessage(result.message)
      } else {
        setActionMessage(result.error || result.message)
      }
    } catch (err) {
      setTestResult({
        success: false,
        tables_count: 0,
        tables: [],
        message: "Network error connecting to API backend.",
        error: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveAndConnect() {
    setConnecting(true)
    setActionMessage("")
    try {
      const result = await api.connectDatabase(getPayload())
      setTestResult(result)
      if (result.success) {
        setActionMessage(result.message)
        await loadDatabaseStatus()
      } else {
        setActionMessage(result.error || result.message)
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to activate database.")
    } finally {
      setConnecting(false)
    }
  }

  async function runChecksNow() {
    setRunningChecks(true)
    setActionMessage("Running quality checks against connected source database...")
    try {
      const response = await api.runChecks()
      setActionMessage(response.success ? "Checks completed successfully." : "Checks completed with errors. Review logs.")
      await loadDatabaseStatus()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Unable to run checks.")
    } finally {
      setRunningChecks(false)
    }
  }

  const businessTables = useMemo(() => {
    const list = testResult?.tables || dbStatus?.tables || []
    return list.filter((t) => !t.is_internal)
  }, [testResult, dbStatus])

  const internalTables = useMemo(() => {
    const list = testResult?.tables || dbStatus?.tables || []
    return list.filter((t) => t.is_internal)
  }, [testResult, dbStatus])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Data Sources & Ingestion"
        title="Connect Database"
        subtitle="Connect, verify, and switch the external database monitored by DataGuard."
        onRefresh={() => {
          loadDatabaseStatus()
        }}
        actions={
          <Button
            onClick={runChecksNow}
            disabled={runningChecks}
            className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] transition"
          >
            {runningChecks ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            {runningChecks ? "Running..." : "Run Checks Now"}
          </Button>
        }
      />

      {/* Action / Notification Message */}
      {actionMessage ? (
        <Card className="rounded-md border border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]">
          <CardContent className="p-4 text-sm font-medium">{actionMessage}</CardContent>
        </Card>
      ) : null}

      {/* =========================================================================
          SECTION 1: CONNECT TARGET DATABASE STUDIO
          ========================================================================= */}
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-white">Connect Target Database</CardTitle>
            <CardDescription className="text-zinc-400">
              Provide credentials for the database you want DataGuard to inspect, profile, and remediate.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fillLocalDefaults}
            className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <Sparkles className="size-3.5 text-[#B3FF4C]" />
            Fill Local PostgreSQL Defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Grid */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              1. Select Database Type
            </label>
            <div className="mt-2.5 max-w-sm">
              {PROVIDERS.map((provider) => {
                const isSelected = selectedProvider === provider.id
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleSelectProvider(provider.id)}
                    className={`flex flex-col justify-between rounded-md border p-4 text-left transition cursor-pointer w-full ${
                      isSelected
                        ? "border-[#B3FF4C] bg-[#B3FF4C]/5 text-white"
                        : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{provider.name}</span>
                        {isSelected ? <Check className="size-4 text-[#B3FF4C]" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{provider.description}</p>
                    </div>
                    <div className="mt-3 text-[0.68rem] font-mono font-medium text-zinc-400">
                      Default Port: {provider.defaultPort}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Connection Mode Toggle */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                2. Connection Parameters
              </label>
              <div className="flex rounded-md border border-white/10 bg-black/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setConnectionMode("params")}
                  className={`rounded-sm px-3 py-1 font-medium transition cursor-pointer ${
                    connectionMode === "params" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Standard Form
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMode("uri")}
                  className={`rounded-sm px-3 py-1 font-medium transition cursor-pointer ${
                    connectionMode === "uri" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Connection URI
                </button>
              </div>
            </div>

            {connectionMode === "params" ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label className="text-xs text-zinc-300">Host / Endpoint</Label>
                  <Input
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost or db.example.com"
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-white focus-visible:border-[#B3FF4C]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Port</Label>
                  <Input
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="5432"
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-white focus-visible:border-[#B3FF4C]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Database Name</Label>
                  <Input
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    placeholder="production_db"
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-white focus-visible:border-[#B3FF4C]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Username</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="postgres or readonly_user"
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-white focus-visible:border-[#B3FF4C]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="mt-1.5 border-white/10 bg-white/[0.03] text-white focus-visible:border-[#B3FF4C]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">SSL Mode</Label>
                  <select
                    value={sslMode}
                    onChange={(e) => setSslMode(e.target.value)}
                    className="mt-1.5 h-8 w-full rounded-md border border-white/10 bg-[#141414] px-2.5 py-1 text-sm text-white outline-none focus:border-[#B3FF4C]"
                  >
                    <option value="prefer">prefer (Default)</option>
                    <option value="require">require (Cloud SSL)</option>
                    <option value="disable">disable (Local Dev)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <Label className="text-xs text-zinc-300">Connection String URI</Label>
                <Input
                  value={connectionUri}
                  onChange={(e) => setConnectionUri(e.target.value)}
                  placeholder="postgresql://user:password@hostname:5432/database_name?sslmode=require"
                  className="mt-1.5 font-mono text-xs border-white/10 bg-white/[0.03] text-white focus-visible:border-[#B3FF4C]"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  Standard URI format: <span className="font-mono text-zinc-400">postgresql://[user]:[password]@[host]:[port]/[database]</span>
                </p>
              </div>
            )}
          </div>

          {/* Test & Save Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
              className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {testing ? "Testing Handshake..." : "Test Connection"}
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={connecting || testing}
              className="bg-[#B3FF4C] text-black font-semibold hover:bg-[#a3f03b] transition"
            >
              {connecting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {connecting ? "Activating Database..." : "Save & Connect Database"}
            </Button>
          </div>

          {/* Live Test Results Card */}
          {testResult ? (
            <div
              className={`rounded-md border p-4 transition ${
                testResult.success
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/5 text-rose-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {testResult.success ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                  {testResult.message}
                </div>
                {testResult.latency_ms ? (
                  <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-sm bg-white/10 text-white">
                    {testResult.latency_ms} ms latency
                  </span>
                ) : null}
              </div>

              {testResult.error ? (
                <div className="mt-2.5 rounded-md border border-rose-500/20 bg-rose-500/10 p-2.5 font-mono text-xs text-rose-300 whitespace-pre-wrap">
                  {testResult.error}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Discovered Tables Grid */}
          {(testResult?.tables?.length || dbStatus?.tables?.length) ? (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Discovered Tables ({businessTables.length} user business tables, {internalTables.length} monitoring tables)
                </label>
              </div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {businessTables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Table2 className="size-4 shrink-0 text-[#B3FF4C]" />
                      <span className="truncate text-sm font-semibold text-white">{table.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-zinc-400">
                      {table.columns_count ? <span>{table.columns_count} cols</span> : null}
                      {table.row_count !== null && table.row_count !== undefined ? (
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-300">
                          ~{table.row_count} rows
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* =========================================================================
          SECTION 2: CURRENT ACTIVE SOURCE DATABASE
          ========================================================================= */}
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Current Active Source</span>
              {dbStatus?.connected ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-400">
                  <span className="size-1.5 rounded-sm bg-emerald-400" />
                  Connected & Reachable
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-rose-400">
                  <span className="size-1.5 rounded-sm bg-rose-400" />
                  Disconnected
                </span>
              )}
            </div>
            <CardTitle className="mt-1 text-xl text-white flex items-center gap-2">
              <Database className="size-5 text-[#B3FF4C]" />
              {dbStatus?.database || "Default Database"}
              <span className="text-xs font-mono font-normal text-zinc-400">
                ({dbStatus?.source_type?.toUpperCase() || "POSTGRESQL"})
              </span>
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Host: <span className="font-mono text-zinc-300">{dbStatus?.host || "localhost"}:{dbStatus?.port || 5432}</span> • User: <span className="font-mono text-zinc-300">{dbStatus?.username || "postgres"}</span> • Latency: <span className="font-mono text-[#B3FF4C]">{dbStatus?.latency_ms ? `${dbStatus.latency_ms} ms` : "Verified"}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDatabaseStatus}
              disabled={loadingStatus}
              className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw className={`size-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
              Verify Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="text-xs font-medium text-zinc-400">User Data Tables</div>
              <div className="mt-1.5 text-xl font-bold text-white">
                {businessTables.length} detected
              </div>
              <div className="mt-1 text-xs text-zinc-500 truncate">
                {businessTables.map((t) => t.name).join(", ") || "No business tables"}
              </div>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="text-xs font-medium text-zinc-400">Database Engine</div>
              <div className="mt-1.5 text-sm font-semibold text-white truncate">
                {dbStatus?.database_version?.split(",")[0] || "PostgreSQL 16"}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Driver: postgresql+psycopg2
              </div>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="text-xs font-medium text-zinc-400">Connection Mode</div>
              <div className="mt-1.5 text-sm font-semibold text-white">
                {dbStatus?.is_separate_source ? "Dedicated Source DB" : "Co-located with Monitor DB"}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Last checked {lastChecked || "just now"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
