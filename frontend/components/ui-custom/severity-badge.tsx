import { Badge } from "@/components/ui/badge"
import { formatSeverity } from "@/lib/formatters"
import { getSeverityTone } from "@/lib/theme"
import { cn } from "@/lib/utils"

type SeverityBadgeProps = {
  severity?: string | null
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const tone = getSeverityTone(severity ?? undefined)
  return (
    <Badge
      variant="outline"
      className={cn(
        "border px-2.5 py-1 font-medium text-xs",
        tone === "danger" && "border-rose-500/30 bg-rose-500/10 text-rose-400",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        tone === "info" && "border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C]",
        tone === "neutral" && "border-white/10 bg-white/5 text-zinc-400",
        className
      )}
    >
      {formatSeverity(severity)}
    </Badge>
  )
}

