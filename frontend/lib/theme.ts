export const enterpriseTheme = {
  colors: {
    primary: "#B3FF4C",
    success: "#22c55e",
    warning: "#eab308",
    danger: "#f43f5e",
    muted: "#71717a",
    slate: "#141414",
  },
  chartColors: ["#B3FF4C", "#22c55e", "#eab308", "#f43f5e", "#a855f7", "#38bdf8"],
}

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info"

export function getStatusTone(status?: string): StatusTone {
  const normalized = String(status ?? "").toUpperCase()
  if (["PASS", "PASSED", "RESOLVED", "HEALTHY", "OK"].includes(normalized)) return "success"
  if (["WARN", "WARNING", "SKIPPED", "INFO", "ACKNOWLEDGED", "INVESTIGATING"].includes(normalized)) return "warning"
  if (["FAIL", "FAILED", "CRITICAL", "HIGH", "OPEN", "ESCALATED", "BREACHED"].includes(normalized)) return "danger"
  return "neutral"
}

export function getSeverityTone(severity?: string): StatusTone {
  const normalized = String(severity ?? "").toUpperCase()
  if (["CRITICAL", "HIGH"].includes(normalized)) return "danger"
  if (["MEDIUM", "WARNING"].includes(normalized)) return "warning"
  if (["LOW", "INFO"].includes(normalized)) return "info"
  return "neutral"
}

