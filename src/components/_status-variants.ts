import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
} from "@remixicon/react"

export type StatusVariant = "info" | "success" | "warning" | "error" | "neutral"

export const statusIcon = {
  info: RiInformationLine,
  success: RiCheckboxCircleLine,
  warning: RiErrorWarningLine,
  error: RiCloseCircleLine,
  neutral: RiInformationLine,
} as const

export const statusIconColor: Record<StatusVariant, string> = {
  info: "text-blue-600 dark:text-blue-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-yellow-700 dark:text-yellow-500",
  error: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
}

// Surface palette (border + bg + text) for status-tinted containers
// like Alert and Banner. Keep `light dark:` pairs centralized here so
// new variants don't drift between components.
export const statusSurface: Record<StatusVariant, string> = {
  info: "border-blue-500/25 bg-blue-50 text-blue-900 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200",
  success:
    "border-emerald-600/25 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning:
    "border-yellow-600/30 bg-yellow-50 text-yellow-900 dark:border-yellow-400/25 dark:bg-yellow-500/10 dark:text-yellow-200",
  error:
    "border-destructive/30 bg-destructive/5 text-destructive dark:border-destructive/40 dark:bg-destructive/10",
  neutral: "border-border bg-muted text-foreground",
}

export const statusIconBubble: Record<StatusVariant, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  error: "bg-red-500/10 text-red-700 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
}
