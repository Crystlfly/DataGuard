"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

const labels: Record<string, string> = {
  dashboard: "Executive Dashboard",
  regressions: "Run Regressions",
  profile: "My Profile",
  remediation: "Data Remediation Center",
  rules: "Rules",
  admin: "Admin",
  setup: "Setup",
  users: "User Management",
  "audit-logs": "Audit Logs",
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const parts = pathname.split("/").filter(Boolean)

  return (
    <div className="flex items-center gap-1 text-xs text-zinc-500">
      <Link href="/dashboard" className="hover:text-white transition">
        Home
      </Link>
      {parts.map((part, index) => {
        const href = `/${parts.slice(0, index + 1).join("/")}`
        return (
          <div className="flex items-center gap-1" key={href}>
            <ChevronRight className="size-3 text-zinc-600" />
            <Link href={href} className="hover:text-white transition">
              {labels[part] ?? part}
            </Link>
          </div>
        )
      })}
    </div>
  )
}
