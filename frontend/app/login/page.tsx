"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
} from "lucide-react"

import { api, clearStoredApiToken, setStoredUserSession } from "@/lib/api-client"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState(process.env.NEXT_PUBLIC_USER_NAME ?? "admin")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await api.login({ username, password })
      setStoredUserSession(response.token, response.user)
      router.push("/dashboard")
    } catch (err) {
      clearStoredApiToken()
      setError(err instanceof Error ? err.message : "Login failed. Check your username and password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen w-full bg-[#050505] text-white selection:bg-[#B3FF4C]/30 selection:text-white font-sans antialiased flex flex-col items-center justify-center p-3 sm:p-5 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[700px] bg-[#B3FF4C]/5 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Main Split Card Container - Compact & Sleek Padding */}
      <div className="relative z-10 w-full max-w-4xl xl:max-w-5xl rounded-[28px] sm:rounded-[36px] border border-white/[0.08] bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-2.5 sm:p-3 md:p-3.5 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 items-stretch">
          
          {/* =========================================================================
              LEFT PANEL: VISUAL CARD WITH HERO.SVG BACKGROUND (MATCHING HERO SECTION)
              ========================================================================= */}
          <div className="md:col-span-6 relative rounded-[20px] sm:rounded-[28px] border border-white/10 bg-black overflow-hidden flex flex-col justify-between p-6 sm:p-7 lg:p-8 min-h-[340px] md:min-h-[480px]">
            {/* Background hero.svg Art */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
              <img
                src="/hero.svg"
                alt="DataGuard Ambient Glow"
                className="w-full h-full object-cover object-center opacity-85 scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            </div>

            {/* Top Logo / Brand Symbol */}
            <div className="relative z-10 flex items-center">
              <Link
                href="/"
                className="flex items-center gap-2.5 group transition-opacity hover:opacity-90 cursor-pointer"
                aria-label="Back to landing page"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-black/60 border border-white/15 backdrop-blur-md transition-colors group-hover:border-white/30">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                    <circle cx="12" cy="12" r="3" stroke="#B3FF4C" strokeWidth="2" />
                    <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.75" />
                    <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.75" />
                    <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                    <circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                  </svg>
                </div>
                <span className="text-sm font-bold tracking-tight text-white transition-colors group-hover:text-zinc-200">
                  DataGuard
                </span>
              </Link>
            </div>

            {/* Bottom Copy */}
            <div className="relative z-10 space-y-2 mt-auto">
              <div className="text-[11px] font-bold tracking-[0.22em] text-[#B3FF4C] uppercase">
                DATA OBSERVABILITY &amp; TRUST
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                Take command of your enterprise data quality
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
                Continuous checks, schema drift monitoring, and one-click remediation.
              </p>
            </div>
          </div>

          {/* =========================================================================
              RIGHT PANEL: SLEEK SIGN IN FORM
              ========================================================================= */}
          <div className="md:col-span-6 flex flex-col justify-center px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            {/* Header / Brand Icon */}
            <div className="mb-5 sm:mb-6">
              <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B3FF4C] mb-3">
                <Lock className="size-4" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Sign in to your account
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Enter your credentials to access your database monitors and alerts.
              </p>
            </div>

            {/* Login Form */}
            <form className="space-y-3.5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300" htmlFor="username">
                  Username or email
                </label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 sm:py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#B3FF4C] focus:bg-white/[0.07] focus:ring-1 focus:ring-[#B3FF4C] outline-none transition-all duration-150"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 sm:py-3 pr-11 text-sm text-white placeholder:text-zinc-600 focus:border-[#B3FF4C] focus:bg-white/[0.07] focus:ring-1 focus:ring-[#B3FF4C] outline-none transition-all duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2.5 leading-relaxed animate-in fade-in">
                  <KeyRound className="size-4 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-red-200 mb-0.5">Access Denied</span>
                    {error}
                  </div>
                </div>
              ) : null}

              {/* Submit Pill Button */}
              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="w-full rounded-xl bg-white text-black font-semibold text-sm py-2.5 sm:py-3 px-4 hover:bg-zinc-200 transition-all duration-200 shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="size-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Default credentials hint */}
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
              <span>Local default credentials:</span>
              <code className="text-[#B3FF4C] bg-white/[0.03] px-2 py-0.5 rounded font-mono text-[11px]">
                admin / admin_password
              </code>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
