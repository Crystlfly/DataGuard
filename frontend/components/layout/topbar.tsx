"use client"

import { RefreshCw } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { UserMenu } from "@/components/layout/user-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_VERSION, ENVIRONMENT_NAME } from "@/lib/constants"

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#080808]/90 px-4 backdrop-blur-md lg:px-8">
      <div className="min-w-0">
        <Breadcrumbs />
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="border-[#B3FF4C]/30 bg-[#B3FF4C]/10 text-[#B3FF4C] font-mono text-[0.68rem] font-semibold">
            {ENVIRONMENT_NAME}
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-400 font-mono text-[0.68rem]">
            {APP_VERSION}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          aria-label="Refresh page"
          className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}

