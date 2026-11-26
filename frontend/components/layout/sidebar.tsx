"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Database,
  GitCompareArrows,
  LayoutDashboard,
  SlidersHorizontal,
  Wrench,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"

export function Sidebar() {
  const pathname = usePathname()
  const [dbInfo, setDbInfo] = useState<{ connected: boolean; database: string } | null>(null)

  useEffect(() => {
    api.databaseStatus()
      .then((res) => {
        if (res?.connected && res.database) {
          setDbInfo({ connected: true, database: res.database })
        }
      })
      .catch(() => {})
  }, [pathname])

  const visibleGroups = [
    {
      label: "Data Sources",
      items: [
        { href: "/admin/setup", label: "Connect Database", icon: Database },
      ],
    },
    ...(dbInfo?.connected
      ? [
          {
            label: `DB: ${dbInfo.database}`,
            isDatabase: true,
            items: [
              { href: "/rules", label: "Quality Rules", icon: SlidersHorizontal },
            ],
          },
        ]
      : []),
    {
      label: "Command Center",
      items: [
        { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
        { href: "/regressions", label: "Run Regressions", icon: GitCompareArrows },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/remediation", label: "Data Remediation Center", icon: Wrench },
      ],
    },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-76 border-r border-white/[0.08] bg-[#080808] text-zinc-100 lg:flex lg:flex-col">
      <Link href="/" className="flex h-16 items-center gap-3 border-b border-white/[0.08] px-5 hover:opacity-90 transition">
        <div className="flex size-9 items-center justify-center rounded-md bg-black/60 border border-white/15">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
            <circle cx="12" cy="12" r="3" stroke="#B3FF4C" strokeWidth="2" />
            <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold tracking-tight text-white">DataGuard</div>
          <div className="text-[0.62rem] font-medium text-zinc-500 uppercase tracking-wider">Enterprise Console</div>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {visibleGroups.map((group) => (
          <div className="mb-4" key={group.label}>
            {group.isDatabase ? (
              <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#B3FF4C]">
                <span className="size-1.5 rounded-full bg-[#B3FF4C]" />
                <span className="truncate">{group.label}</span>
              </div>
            ) : (
              <div className="px-3 pb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <Link
                    key={`${group.label}-${item.label}`}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-[#B3FF4C]/10 text-[#B3FF4C] font-semibold border border-[#B3FF4C]/20"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.08] p-3">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5 text-[0.7rem] leading-relaxed text-zinc-400">
          API-protected SaaS console for data quality operations, governance, and incident triage.
        </div>
      </div>
    </aside>
  )
}
