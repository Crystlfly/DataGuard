"use client"

import { RefreshCw } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { UserMenu } from "@/components/layout/user-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_VERSION, ENVIRONMENT_NAME } from "@/lib/constants"

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#080808]/90 px-4 backdrop-blur-md lg:px-6">
      <div className="min-w-0">
        <Breadcrumbs />
        <div className="mt-0.5 flex items-center gap-1.5">
          <Badge variant="outline" className="border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C] font-mono text-[0.62rem] font-semibold px-1.5 py-0.5">
            {ENVIRONMENT_NAME}
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-400 font-mono text-[0.62rem] px-1.5 py-0.5">
            {APP_VERSION}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          aria-label="Refresh page"
          className="h-7 px-2.5 text-xs border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          <RefreshCw className="size-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}

