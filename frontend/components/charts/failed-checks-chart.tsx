"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { EmptyChart } from "@/components/charts/empty-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type FailedPoint = { dataset: string; failed: number }

export function FailedChecksChart({ data }: { data: FailedPoint[] }) {
  if (!data.length) return <EmptyChart message="No failed checks found for this view." />

  return (
    <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
      <CardHeader>
        <CardTitle className="text-white">Failed Checks by Dataset</CardTitle>
        <CardDescription className="text-zinc-400">Datasets contributing most to quality failures.</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis dataKey="dataset" tickLine={false} axisLine={false} stroke="#71717a" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#71717a" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "0.75rem",
                color: "#fff",
              }}
              cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
            />
            <Bar dataKey="failed" fill="#f43f5e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

