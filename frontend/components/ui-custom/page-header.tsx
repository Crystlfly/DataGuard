import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

type PageHeaderProps = {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  onRefresh?: () => void
}

export function PageHeader({ title, subtitle, eyebrow, actions, onRefresh }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#141414] p-5 lg:flex-row lg:items-center">
      <div>
        {eyebrow ? <div className="text-xs font-bold uppercase tracking-wider text-[#B3FF4C]">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {onRefresh ? (
          <Button
            variant="outline"
            onClick={onRefresh}
            className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            Refresh
          </Button>
        ) : null}
        {actions}
      </div>
    </div>
  )
}

