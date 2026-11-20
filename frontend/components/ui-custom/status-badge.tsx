import { Badge } from "@/components/ui/badge"
import { getStatusTone } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { formatStatus } from "@/lib/formatters"

type StatusBadgeProps = {
  status?: string | null
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = getStatusTone(status ?? undefined)
  return (
    <Badge
      variant="outline"
      className={cn(
        "border px-2 py-0.5 font-medium text-[0.68rem] leading-none",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        tone === "danger" && "border-rose-500/30 bg-rose-500/10 text-rose-400",
        tone === "info" && "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]",
        tone === "neutral" && "border-white/10 bg-white/5 text-zinc-400",
        className
      )}
    >
      {formatStatus(status)}
    </Badge>
  )
}

