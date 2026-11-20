import { CircleDot } from "lucide-react"

import { formatDateTime } from "@/lib/formatters"
import type { AlertRecord } from "@/lib/types"

export function AlertTimeline({ alert }: { alert?: AlertRecord }) {
  if (!alert) return null

  const items = [
    { label: "Created", time: alert.created_at },
    alert.escalated_at ? { label: "Escalated", time: alert.escalated_at } : null,
    alert.resolved_at ? { label: "Resolved", time: alert.resolved_at } : null,
  ].filter(Boolean) as { label: string; time?: string }[]

  return (
    <div className="rounded-md border border-white/[0.08] bg-[#141414] p-3.5">
      <div className="text-sm font-semibold text-white">Alert Timeline</div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div className="flex gap-3 text-sm" key={item.label}>
            <CircleDot className="mt-0.5 size-4 text-[#B3FF4C]" />
            <div>
              <div className="font-medium text-white">{item.label}</div>
              <div className="text-zinc-400">{formatDateTime(item.time)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

