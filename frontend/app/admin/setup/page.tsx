"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Database,
  ExternalLink,
  FileCheck2,
  HardDrive,
  KeyRound,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
  Server,
  Sparkles,
  Table2,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EnterpriseMetricCard } from "@/components/ui-custom/metric-card"
import { PageHeader } from "@/components/ui-custom/page-header"
import { StatusBadge } from "@/components/ui-custom/status-badge"
import { api, getApiBaseUrl, getStoredApiToken } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type {
  DatabaseConnectionPayload,
  DatabaseStatusResponse,
  DatabaseTestResponse,
  RunSummary,
  TableSummary,
} from "@/lib/types"

type CheckStatus = "PASS" | "FAIL" | "WARN" | "INFO" | "CHECKING"

type SetupCheck = {
  id: string
  title: string
  description: string
  status: CheckStatus
  detail: string
  action: string
  icon: typeof CheckCircle2
}

const PROVIDERS = [
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "Relational & Cloud DB",
    defaultPort: 5432,
    badge: "Recommended",
    description: "Connect to self-hosted, AWS RDS, Supabase, Neon, or GCP Cloud SQL.",
  },
  {
    id: "redshift",
    name: "Amazon Redshift",
    category: "Cloud Data Warehouse",
    defaultPort: 5439,
    badge: "AWS Native",
    description: "Enterprise analytics cluster on Amazon Web Services.",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "Data Cloud",
    defaultPort: 443,
    badge: "Data Cloud",
    description: "Scalable cloud warehouse for analytics and multi-cloud datasets.",
  },
  {
    id: "bigquery",
    name: "Google BigQuery",
    category: "Serverless Analytics",
    defaultPort: 443,
    badge: "GCP Native",
    description: "Petabyte-scale serverless data warehouse on Google Cloud.",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "Document Store",
    defaultPort: 27017,
    badge: "NoSQL",
    description: "Document-oriented database for operational collections.",
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
  const [database, setDatabase] = useState("data_quality_db")
  const [username, setUsername] = useState("postgres")
  const [password, setPassword] = useState("")
  const [sslMode, setSslMode] = useState("prefer")
  const [connectionUri, setConnectionUri] = useState("")

  // Test & Connect Actions
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [testResult, setTestResult] = useState<DatabaseTestResponse | null>(null)
  const [actionMessage, setActionMessage] = useState("")

  // Diagnostics Checklist State
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [checks, setChecks] = useState<SetupCheck[]>([])
  const [latestRun, setLatestRun] = useState<RunSummary | null>(null)
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
      if (status.host && !host) setHost(status.host)
      if (status.port && !port) setPort(String(status.port))
      if (status.database && !database) setDatabase(status.database)
      if (status.username && !username) setUsername(status.username)
    } catch (err) {
      console.error("Failed to load active database status:", err)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    loadDatabaseStatus()
    runSetupChecks()
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
    setDatabase("data_quality_db")
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

  // Preflight Diagnostic Checks
  async function runSetupChecks() {
    setChecks(baseChecks("CHECKING"))
    const token = getStoredApiToken()
    const nextChecks = baseChecks("INFO")

    nextChecks[0] = {
      ...nextChecks[0],
      status: getApiBaseUrl() && token ? "PASS" : "WARN",
      detail: getApiBaseUrl()
        ? `Frontend points to ${getApiBaseUrl()}${token ? " and has an API token in session/env." : " but no API token is available."}`
        : "NEXT_PUBLIC_API_BASE_URL is not configured.",
      action: token ? "No action required." : "Log in again or set NEXT_PUBLIC_API_TOKEN in frontend/.env.local.",
    }

    try {
      const health = await api.health()
      nextChecks[1] = {
        ...nextChecks[1],
        status: health.status === "ok" ? "PASS" : "WARN",
        detail: `FastAPI health endpoint returned ${health.status}.`,
        action: "Keep uvicorn running while using the frontend.",
      }
    } catch (err) {
      nextChecks[1] = {
        ...nextChecks[1],
        status: "FAIL",
        detail: err instanceof Error ? err.message : "Backend unreachable",
        action: "Start backend with uvicorn api.app:app --reload.",
      }
    }

    try {
      await api.runs()
      nextChecks[2] = {
        ...nextChecks[2],
        status: "PASS",
        detail: "Protected API request succeeded with current session token.",
        action: "No action required.",
      }
    } catch (err) {
      nextChecks[2] = {
        ...nextChecks[2],
        status: "FAIL",
        detail: err instanceof Error ? err.message : "Auth check failed",
        action: "Ensure session credentials match API_TOKEN.",
      }
    }

    try {
      const ready = await api.ready()
      nextChecks[3] = {
        ...nextChecks[3],
        status: ready.status === "ready" ? "PASS" : "FAIL",
        detail: `Monitoring database is ${ready.database ?? ready.status}.`,
        action: ready.status === "ready" ? "No action required." : "Check database environment variables.",
      }
    } catch (err) {
      nextChecks[3] = {
        ...nextChecks[3],
        status: "FAIL",
        detail: err instanceof Error ? err.message : "Database check failed",
        action: "Run python cli.py init-db after confirming PostgreSQL is running.",
      }
    }

    try {
      const runs = await api.runs()
      const latest = runs[0] ?? null
      setLatestRun(latest)
      nextChecks[4] = {
        ...nextChecks[4],
        status: runs.length ? "PASS" : "WARN",
        detail: runs.length
          ? `Monitoring tables are readable. Latest run is #${latest?.run_id}.`
          : "Monitoring tables are reachable but no runs exist yet.",
        action: runs.length ? "No action required." : "Run checks once to populate run history.",
      }
      nextChecks[5] = {
        ...nextChecks[5],
        status: runs.length ? "PASS" : "WARN",
        detail: runs.length
          ? `Previous data extraction completed at ${formatDateTime(latest?.run_time)}.`
          : "Source DB verified through active connector.",
        action: "Use Run Checks Now to validate source DB access.",
      }
    } catch (err) {
      nextChecks[4] = {
        ...nextChecks[4],
        status: "FAIL",
        detail: err instanceof Error ? err.message : "Table check failed",
        action: "Initialize monitoring tables with python cli.py init-db.",
      }
      nextChecks[5] = {
        ...nextChecks[5],
        status: "WARN",
        detail: "Source DB cannot be inferred until monitoring tables are reachable.",
        action: "Fix monitoring DB first, then run checks.",
      }
    }

    try {
      const rules = await api.rules()
      nextChecks[6] = {
        ...nextChecks[6],
        status: rules.length ? "PASS" : "WARN",
        detail: rules.length ? `${rules.length} active rule rows loaded from rules.yaml.` : "Rules catalog returned no rows.",
        action: rules.length ? "No action required." : "Check config/rules.yaml.",
      }
    } catch (err) {
      nextChecks[6] = {
        ...nextChecks[6],
        status: "FAIL",
        detail: err instanceof Error ? err.message : "Rules check failed",
        action: "Validate config/rules.yaml syntax.",
      }
    }

    nextChecks[7] = {
      ...nextChecks[7],
      status: "INFO",
      detail: "Notification readiness configured through backend notification modules.",
      action: "Open Notification Center for channel-level setup.",
    }

    setChecks(nextChecks)
    setLastChecked(formatDateTime(new Date()))
  }

  async function runChecksNow() {
    setRunningChecks(true)
    setActionMessage("Running quality checks against connected source database...")
    try {
      const response = await api.runChecks()
      setActionMessage(response.success ? "Checks completed successfully." : "Checks completed with errors. Review logs.")
      await loadDatabaseStatus()
      await runSetupChecks()
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
          runSetupChecks()
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
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PROVIDERS.map((provider) => {
                const isSelected = selectedProvider === provider.id
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleSelectProvider(provider.id)}
                    className={`flex flex-col justify-between rounded-md border p-4 text-left transition cursor-pointer ${
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

      {/* =========================================================================
          SECTION 3: PREFLIGHT SYSTEM DIAGNOSTICS (COLLAPSIBLE)
          ========================================================================= */}
      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader
          className="cursor-pointer flex flex-row items-center justify-between select-none"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
        >
          <div>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Server className="size-4 text-zinc-400" />
              System Readiness & Environment Diagnostics
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Verify backend API health, authentication token, rules configuration, and monitoring tables.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation()
              setShowDiagnostics(!showDiagnostics)
            }}
          >
            {showDiagnostics ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {showDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
          </Button>
        </CardHeader>

        {showDiagnostics ? (
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(checks.length ? checks : baseChecks("CHECKING")).map((check) => {
                const Icon = check.icon
                return (
                  <div key={check.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Icon className="size-4 text-zinc-400" />
                        {check.title}
                      </div>
                      <StatusBadge status={check.status} />
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{check.detail}</p>
                    <div className="text-[0.7rem] text-zinc-500">
                      <span className="font-semibold text-zinc-400">Action:</span> {check.action}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        ) : null}
      </Card>
    </AppShell>
  )
}

function baseChecks(status: CheckStatus): SetupCheck[] {
  return [
    {
      id: "frontend-env",
      title: "Frontend environment",
      description: "NEXT_PUBLIC_API_BASE_URL and API token availability.",
      status,
      detail: "Waiting for frontend environment check.",
      action: "Confirm frontend/.env.local.",
      icon: FileCheck2,
    },
    {
      id: "api-health",
      title: "FastAPI health",
      description: "Public backend health endpoint.",
      status,
      detail: "Waiting for API health check.",
      action: "Start uvicorn if this check fails.",
      icon: Server,
    },
    {
      id: "api-auth",
      title: "API auth status",
      description: "Protected X-API-Key request validation.",
      status,
      detail: "Waiting for API authentication check.",
      action: "Use the API_TOKEN from backend .env.",
      icon: KeyRound,
    },
    {
      id: "monitor-db",
      title: "Monitoring DB connection",
      description: "Backend readiness check against PostgreSQL.",
      status,
      detail: "Waiting for database readiness check.",
      action: "Check PostgreSQL and database environment variables.",
      icon: Database,
    },
    {
      id: "monitor-tables",
      title: "Monitoring tables",
      description: "Run history endpoint confirms table readability.",
      status,
      detail: "Waiting for monitoring table check.",
      action: "Run python cli.py init-db if tables are missing.",
      icon: Table2,
    },
    {
      id: "source-db",
      title: "Source DB connection",
      description: "Inferred from successful historical data quality runs.",
      status,
      detail: "Waiting for source DB inference.",
      action: "Run checks to verify source extraction.",
      icon: Database,
    },
    {
      id: "rules",
      title: "rules.yaml status",
      description: "Rules Catalog API validates flattened YAML rules.",
      status,
      detail: "Waiting for rules check.",
      action: "Fix YAML if this check fails.",
      icon: FileCheck2,
    },
    {
      id: "notifications",
      title: "Notification config",
      description: "Mailtrap, Slack, and Teams setup readiness.",
      status,
      detail: "Waiting for notification config check.",
      action: "Review backend .env notification variables.",
      icon: Send,
    },
  ]
}
