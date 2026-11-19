import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EnterpriseMetricCardProps = {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  tone?: "blue" | "green" | "amber" | "red" | "slate"
}

const toneClasses = {
  blue: "bg-[#B3FF4C]/10 text-[#B3FF4C] ring-1 ring-[#B3FF4C]/30",
  green: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30",
  red: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30",
  slate: "bg-white/5 text-zinc-400 ring-1 ring-white/10",
}

export function EnterpriseMetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: EnterpriseMetricCardProps) {
  return (
    <Card className="rounded-xl border border-white/[0.08] bg-[#141414] text-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
            <div className="mt-3 text-2xl font-bold tracking-tight text-white">{value}</div>
            {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
          </div>
          {Icon ? (
            <div className={cn("rounded-xl p-2.5", toneClasses[tone])}>
              <Icon className="size-5" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

