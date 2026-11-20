"use client"

import { FormEvent, useEffect, useState } from "react"
import { CheckCircle2, Clock3, UserRound } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/ui-custom/page-header"
import { StatusBadge } from "@/components/ui-custom/status-badge"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/formatters"
import type { AppUser, ProfileUpdatePayload } from "@/lib/types"

const emptyProfile: ProfileUpdatePayload = {
  full_name: "",
  email: "",
  job_title: "",
  department: "",
  phone_number: "",
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [form, setForm] = useState<ProfileUpdatePayload>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function loadProfile() {
    setLoading(true)
    setError("")
    try {
      const current = await api.me()
      setProfile(current)
      setForm({
        full_name: current.full_name ?? "",
        email: current.email ?? "",
        job_title: current.job_title ?? "",
        department: current.department ?? "",
        phone_number: current.phone_number ?? "",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load profile.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  async function submitProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage("")
    setError("")
    try {
      await api.submitProfileUpdate(form)
      setMessage("Profile update submitted for admin approval.")
      await loadProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit profile update.")
    } finally {
      setSaving(false)
    }
  }

  const completion = profile?.profile_completion_percent ?? 0
  const pendingUpdates = profile?.pending_profile_updates ?? []

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        subtitle="Complete your dashboard profile. Changes are reviewed by an admin before they are applied."
        onRefresh={loadProfile}
      />

      {message ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Submitted</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[#B3FF4C]/10 border border-[#B3FF4C]/20 text-[#B3FF4C]">
                <UserRound className="size-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white">{profile?.full_name || profile?.username || "Profile"}</CardTitle>
                <CardDescription className="text-xs text-zinc-400">{profile?.email || "No approved email yet"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">Profile completion</span>
                <span className="text-zinc-400">{completion}%</span>
              </div>
              <Progress value={completion} />
            </div>
            <div className="grid gap-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400">Username</span>
                <span className="font-medium text-white">{profile?.username}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400">Role</span>
                <StatusBadge status={profile?.role} />
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400">Department</span>
                <span className="font-medium text-white">{profile?.department || "Missing"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400">Job title</span>
                <span className="font-medium text-white">{profile?.job_title || "Missing"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-white">Request Profile Update</CardTitle>
            <CardDescription className="text-xs text-zinc-400">Admins approve profile changes before they become active.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProfileUpdate}>
              <ProfileField label="Full name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} />
              <ProfileField label="Email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
              <ProfileField label="Job title" value={form.job_title} onChange={(value) => setForm((current) => ({ ...current, job_title: value }))} />
              <ProfileField label="Department" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
              <ProfileField label="Phone number" value={form.phone_number} onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))} />
              <div className="flex items-end">
                <Button className="w-full text-xs h-8" disabled={loading || saving} type="submit">
                  {saving ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md border border-white/[0.08] bg-[#141414]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Pending Profile Updates</CardTitle>
          <CardDescription className="text-xs text-zinc-400">Requests waiting for admin review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!pendingUpdates.length ? (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-zinc-400">No pending profile updates.</div>
          ) : (
            pendingUpdates.map((update) => (
              <div key={update.id} className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Clock3 className="size-4 text-amber-600" />
                    Request #{update.id}
                  </div>
                  <StatusBadge status={update.status} />
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  {Object.entries(update.requested_changes ?? {}).map(([field, value]) => (
                    <div key={field} className="rounded-lg bg-white/[0.03] p-3">
                      <div className="text-xs uppercase tracking-wide text-zinc-400">{field.replaceAll("_", " ")}</div>
                      <div className="mt-1 font-medium">{value || "Blank"}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-zinc-400">Submitted {formatDateTime(update.submitted_at)}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  )
}

function ProfileField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string
  value?: string
  type?: string
  onChange: (value: string) => void
}) {
  const id = label.toLowerCase().replaceAll(" ", "-")
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
