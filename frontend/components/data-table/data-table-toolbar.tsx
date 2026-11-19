"use client"

import { Download, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type DataTableToolbarProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  placeholder?: string
  onExport?: () => void
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  placeholder = "Search table...",
  onExport,
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-500" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="border-white/10 bg-white/[0.03] pl-8 text-white placeholder:text-zinc-500 focus-visible:border-[#B3FF4C] focus-visible:ring-[#B3FF4C]/30"
          placeholder={placeholder}
        />
      </div>
      {onExport ? (
        <Button
          variant="outline"
          onClick={onExport}
          className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      ) : null}
    </div>
  )
}

