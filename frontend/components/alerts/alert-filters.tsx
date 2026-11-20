"use client"

import { Input } from "@/components/ui/input"

export type AlertFilters = {
  search: string
  severity: string
  status: string
  ownerTeam: string
  assignedTo: string
}

type AlertFiltersProps = {
  value: AlertFilters
  onChange: (value: AlertFilters) => void
}

export function AlertFiltersPanel({ value, onChange }: AlertFiltersProps) {
  function update(key: keyof AlertFilters, nextValue: string) {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <div className="grid gap-3 rounded-md border border-white/[0.08] bg-[#141414] p-3.5 md:grid-cols-5">
      <Input value={value.search} onChange={(event) => update("search", event.target.value)} placeholder="Search alerts" className="text-xs bg-white/[0.03] border-white/10" />
      <select className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]" value={value.severity} onChange={(event) => update("severity", event.target.value)}>
        <option value="ALL">All severity</option>
        <option value="CRITICAL">Critical</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>
      <select className="rounded-md border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white outline-none focus:border-[#B3FF4C]" value={value.status} onChange={(event) => update("status", event.target.value)}>
        <option value="ALL">All statuses</option>
        <option value="OPEN">Open</option>
        <option value="RESOLVED">Resolved</option>
        <option value="ESCALATED">Escalated</option>
      </select>
      <Input value={value.ownerTeam} onChange={(event) => update("ownerTeam", event.target.value)} placeholder="Owner team" className="text-xs bg-white/[0.03] border-white/10" />
      <Input value={value.assignedTo} onChange={(event) => update("assignedTo", event.target.value)} placeholder="Assigned to" className="text-xs bg-white/[0.03] border-white/10" />
    </div>
  )
}

