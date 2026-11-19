"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { EmptyChart } from "@/components/charts/empty-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type TrendPoint = { run_id?: number | string; quality_score?: number }

export function QualityTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <EmptyChart message="Run checks to populate the quality trend." />

  return (
    <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
      <CardHeader>
        <CardTitle className="text-white">Quality Score Trend</CardTitle>
        <CardDescription className="text-zinc-400">Recent monitoring runs and score movement.</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
            <Line
              type="monotone"
              dataKey="quality_score"
              stroke="#B3FF4C"
              strokeWidth={3}
              isAnimationActive={false}
              dot={{ r: 4, fill: "#B3FF4C" }}
              activeDot={{ r: 6, fill: "#B3FF4C" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

