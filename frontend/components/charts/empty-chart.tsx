import { BarChart3 } from "lucide-react"

export function EmptyChart({ message = "No chart data available." }: { message?: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center text-sm text-zinc-400">
      <BarChart3 className="mb-2 size-7 text-zinc-500" />
      {message}
    </div>
  )
}

