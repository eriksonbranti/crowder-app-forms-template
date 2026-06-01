"use client"

import { useEffect, useState } from "react"
import { formatDateTime, formatRelativeTime } from "@/lib/formatters"

type DateInput = Date | string | null | undefined

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

export function DateTime({ value }: { value: DateInput }) {
  useMounted()
  return <span suppressHydrationWarning>{formatDateTime(value)}</span>
}

export function RelativeTime({ value }: { value: DateInput }) {
  useMounted()
  return <span suppressHydrationWarning>{formatRelativeTime(value)}</span>
}
