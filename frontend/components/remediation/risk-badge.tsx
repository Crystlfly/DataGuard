import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function RiskBadge({ risk }: { risk?: string }) {
  const normalized = String(risk || "LOW").toUpperCase()
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm border px-2 py-0.5 text-[0.68rem] font-medium tracking-wide uppercase",
        normalized === "LOW" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        normalized === "MEDIUM" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        normalized === "HIGH" && "border-red-500/30 bg-red-500/10 text-red-400"
      )}
    >
      {normalized}
    </Badge>
  )
}

