"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  Layers,
  Lock,
  PlayCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react"

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "remediation" | "lineage">("rules")

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-white selection:bg-[#B3FF4C]/30 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* =========================================================================
          HERO SECTION WITH HERO.SVG BACKGROUND (FOLLOWING INSPO DESIGN)
          ========================================================================= */}
      <section className="relative min-h-screen lg:h-screen w-full flex flex-col justify-between overflow-hidden pt-5 pb-6 px-6 sm:px-10 lg:px-16">
        {/* Background Artwork - hero.svg with green glowing orbital arc and wavy contour lines */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
          <img
            src="/hero.svg"
            alt="DataGuard Hero Ambient Art"
            className="w-full h-full object-cover object-top opacity-90 scale-105"
          />
          {/* Subtle vignette gradient to seamlessly ground into #050505 */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/40 to-[#050505]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
        </div>

        {/* --- Top Navigation Bar --- */}
        <header className="relative z-20 mx-auto w-full max-w-7xl flex items-center justify-between py-2">
          {/* Brand Logo - Geometric interconnected symbol matching inspo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-black/60 border border-white/15 backdrop-blur-md transition-transform duration-300 group-hover:scale-105">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="12" r="3" stroke="#B3FF4C" strokeWidth="2" />
                <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">DataGuard</span>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-10 text-sm font-medium text-zinc-300">
            <a href="#overview" className="hover:text-white transition-colors">
              Overview
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#connectors" className="hover:text-white transition-colors">
              Supported DBs
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Architecture
            </a>
          </nav>

          {/* Right Action: Sign In pill button matching inspo */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-white text-black font-semibold px-6 py-2.5 text-sm hover:bg-zinc-200 transition-all duration-200 shadow-md hover:scale-[1.03] active:scale-100"
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* --- Hero Content Grid (Left Copy + Right Browser Mockup) --- */}
        <div className="relative z-10 mx-auto w-full max-w-7xl my-auto py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Eyebrow + Headline + Description + Pill Buttons */}
          <div className="lg:col-span-5 flex flex-col justify-center text-left">
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
              <span className="text-xs sm:text-[13px] font-bold tracking-[0.22em] text-[#B3FF4C] uppercase">
                AUTOMATED DATA QUALITY &amp; OBSERVABILITY
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-bold tracking-tight text-white leading-[1.08] mb-4 sm:mb-5">
              Reliable data will take you places assumptions can&apos;t
            </h1>

            <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed mb-6 max-w-lg">
              Continuous validation, schema drift detection, and one-click data remediation.
              Connect your database in seconds and protect downstream analytics before broken records cause damage.
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-white text-black font-semibold px-6 sm:px-7 py-2.5 sm:py-3 text-sm hover:bg-zinc-200 transition-all duration-200 shadow-lg hover:scale-[1.02] active:scale-100"
              >
                Launch Console
              </Link>
              <Link
                href="/admin/setup"
                className="inline-flex items-center justify-center rounded-full bg-black/40 border border-zinc-700/80 hover:border-zinc-500 text-white font-medium px-6 sm:px-7 py-2.5 sm:py-3 text-sm transition-all duration-200 hover:bg-zinc-900/60"
              >
                Connect Database
              </Link>
            </div>
          </div>

          {/* Right Column: High-Fidelity macOS Console Window Mockup */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0C0F17]/90 shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden transition-all duration-500 hover:border-[#B3FF4C]/30">
              {/* macOS Window Titlebar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-2.5 select-none">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-[#FF5F56] shadow-sm" />
                  <div className="size-3 rounded-full bg-[#FFBD2E] shadow-sm" />
                  <div className="size-3 rounded-full bg-[#27C93F] shadow-sm" />
                </div>

                {/* Center Lock Pill */}
                <div className="flex items-center gap-2 rounded-md bg-white/5 border border-white/5 px-3 py-1 text-xs text-zinc-400 font-mono">
                  <Lock className="size-3 text-[#B3FF4C]" />
                  <span>app.dataguard.io/dashboard</span>
                </div>

                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                  <span className="inline-block size-2 rounded-full bg-[#B3FF4C]" />
                  <span className="text-zinc-400 font-medium">Live</span>
                </div>
              </div>

              {/* Inside Console Surface */}
              <div className="p-4 sm:p-5 space-y-4 bg-[linear-gradient(to_right,#1f293d08_1px,transparent_1px),linear-gradient(to_bottom,#1f293d08_1px,transparent_1px)] bg-[size:20px_20px]">
                {/* Metric Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Quality Score
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">87.3%</span>
                      <span className="text-[11px] font-semibold text-[#B3FF4C]">+4.2%</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Checks Executed
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">79</span>
                      <span className="text-[11px] font-medium text-zinc-400">69 Pass</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      SLA Posture
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">99.2%</span>
                      <span className="text-[11px] font-semibold text-emerald-400">Healthy</span>
                    </div>
                  </div>
                </div>

                {/* Live Rule Execution Stream */}
                <div className="rounded-xl border border-white/5 bg-black/40 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3.5 py-2 text-xs font-semibold text-zinc-400">
                    <span>Active Dataset Validations</span>
                    <span className="text-[#B3FF4C] font-mono text-[11px]">Run #3 completed</span>
                  </div>

                  <div className="divide-y divide-white/5 text-xs font-mono">
                    <div className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span className="text-zinc-200">customers.email</span>
                        <span className="text-zinc-500 font-sans text-[11px]">Regex</span>
                      </div>
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                        PASS (100%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-amber-400" />
                        <span className="text-zinc-200">orders.amount</span>
                        <span className="text-zinc-500 font-sans text-[11px]">Range &gt; 0</span>
                      </div>
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                        3 Flagged &rarr; Remediated
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span className="text-zinc-200">products.sku</span>
                        <span className="text-zinc-500 font-sans text-[11px]">Unique</span>
                      </div>
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                        PASS (0 Dups)
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#B3FF4C]" />
                        <span className="text-zinc-200">orders.customer_id</span>
                        <span className="text-zinc-500 font-sans text-[11px]">FK Integrity</span>
                      </div>
                      <span className="rounded bg-[#B3FF4C]/10 px-2 py-0.5 text-[10px] font-medium text-[#B3FF4C] border border-[#B3FF4C]/20">
                        Auto-Remediate Ready
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Interactive Remediation Footer */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-sans">
                    <ShieldCheck className="size-3.5 text-[#B3FF4C]" />
                    <span className="text-[11px] sm:text-xs">Safe cleaning preview with 1-click rollback</span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#B3FF4C] hover:underline"
                  >
                    Open Live Console
                    <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: SUPPORTED DATA SOURCES STRIP
          ========================================================================= */}
      <section
        id="connectors"
        className="relative z-10 w-full border-y border-white/10 bg-[#080B11] py-12 px-6 sm:px-10 lg:px-16"
      >
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#B3FF4C]">
              Native Connectivity
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight mt-1">
              Connect to your database in minutes
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-sm font-semibold text-zinc-300">
            {[
              { name: "PostgreSQL", badge: "Native" },
              { name: "Amazon Redshift", badge: "Cloud Warehouse" },
              { name: "Snowflake", badge: "Warehouse" },
              { name: "Google BigQuery", badge: "Analytics" },
              { name: "MongoDB", badge: "Document" },
            ].map((db) => (
              <div
                key={db.name}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 hover:border-[#B3FF4C]/40 transition-colors"
              >
                <Database className="size-4 text-[#B3FF4C]" />
                <span className="text-white">{db.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-mono">
                  {db.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: ARCHITECTURE & BENTO FEATURES
          ========================================================================= */}
      <section id="features" className="relative z-10 w-full py-24 px-6 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-bold tracking-[0.2em] text-[#B3FF4C] uppercase">
              ENTERPRISE OBSERVABILITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-3">
              Built to guarantee data trust from ingestion to dashboards
            </h2>
            <p className="mt-4 text-base text-zinc-400 leading-relaxed">
              DataGuard replaces custom brittle SQL test scripts with an intelligent, continuous
              governance suite that non-destructively validates and repairs pipelines.
            </p>
          </div>

          {/* Bento Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0F17]/80 p-7 hover:border-white/20 transition-all">
              <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-5">
                <SlidersHorizontal className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Automated Rule Engine
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Run declarative checks for nullability, uniqueness, foreign keys, regex patterns,
                and numeric ranges across your tables without writing manual boilerplate.
              </p>
              <div className="mt-5 pt-4 border-t border-white/5">
                <Link
                  href="/rules"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3FF4C] hover:underline"
                >
                  Explore Rules Studio &rarr;
                </Link>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0F17]/80 p-7 hover:border-white/20 transition-all">
              <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-5">
                <Wrench className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Safe One-Click Remediation
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Review dirty records, preview the exact SQL transformation with diff view, and
                execute safe fixes with full rollback history.
              </p>
              <div className="mt-5 pt-4 border-t border-white/5">
                <Link
                  href="/remediation"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3FF4C] hover:underline"
                >
                  Visit Remediation Center &rarr;
                </Link>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0F17]/80 p-7 hover:border-white/20 transition-all">
              <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-5">
                <Activity className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Schema Drift &amp; Volume Anomalies
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Instantly detect column type changes, missing attributes, or abnormal volume spikes
                before downstream models generate incorrect predictions.
              </p>
              <div className="mt-5 pt-4 border-t border-white/5">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3FF4C] hover:underline"
                >
                  View Executive Dashboard &rarr;
                </Link>
              </div>
            </div>

            {/* Card 4 */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0F17]/80 p-7 hover:border-white/20 transition-all">
              <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-5">
                <Layers className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Lineage &amp; Blast Radius
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Graph-based dependency mapping showing which analytical models and reporting tables
                are impacted whenever an upstream ingest check fails.
              </p>
              <div className="mt-5 pt-4 border-t border-white/5">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3FF4C] hover:underline"
                >
                  View Quality Health &rarr;
                </Link>
              </div>
            </div>

            {/* Card 5 */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0F17]/80 p-7 hover:border-white/20 transition-all">
              <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-5">
                <CheckCircle2 className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                SLA Compliance &amp; Freshness
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Track data arrival deadlines and minimum quality thresholds. Prevent SLA breaches
                with proactive alerts to Slack, Teams, or Email.
              </p>
              <div className="mt-5 pt-4 border-t border-white/5">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3FF4C] hover:underline"
                >
                  Track Quality Posture &rarr;
                </Link>
              </div>
            </div>

            {/* Card 6 */}
            <div className="rounded-2xl border border-white/10 bg-[#0C0F17]/80 p-7 hover:border-white/20 transition-all">
              <div className="size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-5">
                <Server className="size-5" />
              </div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Self-Hosted &amp; Zero Lock-In
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Runs securely inside your own infrastructure. Direct read-only database connections,
                standard PostgreSQL monitor store, and no external data exfiltration.
              </p>
              <div className="mt-5 pt-4 border-t border-white/5">
                <Link
                  href="/admin/setup"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3FF4C] hover:underline"
                >
                  Configure In Your VPC &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: 3-STEP WORKFLOW WALKTHROUGH
          ========================================================================= */}
      <section id="overview" className="relative z-10 w-full border-t border-white/10 bg-[#080B11] py-24 px-6 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold tracking-[0.2em] text-[#B3FF4C] uppercase">
              HOW IT WORKS
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-3">
              From zero to complete data observability in 3 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-[#B3FF4C] mb-3">STEP 01</div>
                <h3 className="text-xl font-semibold text-white mb-3">Connect Your Database</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Provide your read-only database credentials in <code className="text-[#B3FF4C] font-mono text-xs">.env</code> or through the Setup screen. Supports PostgreSQL, Snowflake, Redshift, and BigQuery.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-white/5 text-xs text-zinc-500 font-mono">
                No agents to install
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-[#B3FF4C] mb-3">STEP 02</div>
                <h3 className="text-xl font-semibold text-white mb-3">Declare Quality Rules</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Specify null checks, regex patterns, range limits, and referential constraints in intuitive YAML. Pre-built standard templates get you started immediately.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-white/5 text-xs text-zinc-500 font-mono">
                config/rules.yaml
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-[#B3FF4C] mb-3">STEP 03</div>
                <h3 className="text-xl font-semibold text-white mb-3">Monitor &amp; Auto-Remediate</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Launch scheduled or on-demand checks. Triage failed records in the remediation drawer and execute non-destructive fixes with instant rollback.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-white/5 text-xs text-zinc-500 font-mono">
                Automated &amp; Audited
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: BOTTOM CALL TO ACTION
          ========================================================================= */}
      <section className="relative z-10 w-full py-20 px-6 sm:px-10 lg:px-16 overflow-hidden">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-b from-[#101524] to-[#080B11] p-10 sm:p-16 text-center relative shadow-2xl">
          <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(179,255,76,0.08)_0%,transparent_70%] pointer-events-none" />

          <span className="text-xs font-bold tracking-[0.25em] text-[#B3FF4C] uppercase">
            READY TO LEVEL UP DATA RELIABILITY?
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mt-4 max-w-2xl mx-auto leading-tight">
            Take full command of your data quality today
          </h2>
          <p className="mt-4 text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Start the console, connect your database, and run automated health checks in minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-white text-black font-semibold px-8 py-3.5 text-sm hover:bg-zinc-200 transition-all duration-200 shadow-xl hover:scale-105 active:scale-100"
            >
              Open Data Quality Console
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-white font-medium px-8 py-3.5 text-sm transition-all duration-200 hover:bg-white/10"
            >
              Sign In to Your Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#050505] py-12 px-6 sm:px-10 lg:px-16 text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="12" r="3" stroke="#B3FF4C" strokeWidth="2" />
                <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-300">DataGuard</span>
            <span>&copy; {new Date().getFullYear()} Automated Data Quality Monitoring System</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
