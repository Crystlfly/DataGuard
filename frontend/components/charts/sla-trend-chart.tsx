"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { EmptyChart } from "@/components/charts/empty-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type SlaPoint = { run_id?: number | string; compliance?: number }

export function SlaTrendChart({ data }: { data: SlaPoint[] }) {
  if (!data.length) return <EmptyChart message="No SLA trend available yet." />

  return (
    <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
      <CardHeader>
        <CardTitle className="text-white">SLA Compliance Trend</CardTitle>
        <CardDescription className="text-zinc-400">Percentage of datasets meeting SLA by run.</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis dataKey="run_id" tickLine={false} axisLine={false} stroke="#71717a" />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#71717a" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "0.75rem",
                color: "#fff",
              }}
              itemStyle={{ color: "#B3FF4C" }}
            />
            <Area
              type="monotone"
              dataKey="compliance"
              stroke="#B3FF4C"
              fill="rgba(179, 255, 76, 0.06)"
              strokeWidth={3}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

