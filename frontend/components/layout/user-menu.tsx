"use client"

import { useRouter } from "next/navigation"
import { LogOut, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { clearStoredApiToken, getStoredUserName, getStoredUserRole } from "@/lib/api-client"

export function UserMenu() {
  const router = useRouter()
  const username = getStoredUserName()
  const role = getStoredUserRole()

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#141414] px-1.5 py-1">
      <div className="flex size-7 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-[#B3FF4C]">
        <UserRound className="size-3.5" />
      </div>
      <div className="hidden text-left md:block pr-1">
        <div className="text-xs font-semibold leading-tight text-white">{username}</div>
        <div className="text-[0.62rem] text-zinc-500">Connected</div>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Open profile"
        className="text-zinc-400 hover:bg-white/10 hover:text-white"
        onClick={() => {
          router.push("/profile")
        }}
      >
        <UserRound className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Logout"
        className="text-zinc-400 hover:bg-white/10 hover:text-rose-400"
        onClick={() => {
          clearStoredApiToken()
          router.push("/login")
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  )
}
