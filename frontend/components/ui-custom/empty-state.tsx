import type { LucideIcon } from "lucide-react"
import { Database } from "lucide-react"

import { Button } from "@/components/ui/button"

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Database,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <div className="rounded-md border border-white/10 bg-white/5 p-3 text-[#B3FF4C]">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-zinc-400">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button
          className="mt-4 border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
          variant="outline"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

