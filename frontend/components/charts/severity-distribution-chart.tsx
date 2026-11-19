"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { EmptyChart } from "@/components/charts/empty-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const colors = ["#f43f5e", "#f59e0b", "#B3FF4C", "#71717a", "#10b981"]

type SeverityPoint = { name: string; value: number }

export function SeverityDistributionChart({
  data,
  title = "Alerts by Severity",
  description = "Current severity distribution.",
}: {
  data: SeverityPoint[]
  title?: string
  description?: string
}) {
  if (!data.length) return <EmptyChart message="No severity data available." />

  return (
    <Card className="rounded-xl border border-white/[0.08] bg-[#141414]">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-zinc-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="#141414" strokeWidth={2} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "0.75rem",
                color: "#fff",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

