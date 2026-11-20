"use client"

import Link from "next/link"
import { Activity, AlertTriangle, BarChart3, ShieldCheck } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui-custom/page-header"

const actions = [
  { href: "/dashboard", title: "Executive Dashboard", description: "Management-ready KPIs and trends.", icon: BarChart3 },
  { href: "/quality-explorer", title: "Quality Explorer", description: "Investigate checks, datasets, columns, and profiles.", icon: Activity },
  { href: "/alerts", title: "Alert Operations", description: "Triage ownership, severity, and alert resolution.", icon: AlertTriangle },
  { href: "/sla", title: "SLA Command Center", description: "Track dataset-level governance commitments.", icon: ShieldCheck },
]

export default function OverviewPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Command Center"
        title="Overview"
        subtitle="Navigate the core operational workspaces in the Data Quality Command Center."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Card className="rounded-md border border-white/[0.08] bg-[#141414]" key={action.href}>
              <CardHeader>
                <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-[#B3FF4C]/10 border border-[#B3FF4C]/20 text-[#B3FF4C]">
                  <Icon className="size-4" />
                </div>
                <CardTitle className="text-white text-sm">{action.title}</CardTitle>
                <CardDescription className="text-zinc-400 text-xs">{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={action.href}
                  className="inline-flex h-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Open
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </AppShell>
  )
}
