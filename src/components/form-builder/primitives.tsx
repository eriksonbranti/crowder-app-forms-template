"use client"

import type { ReactNode } from "react"

import { Label } from "@/components/Label"
import { Switch } from "@/components/Switch"
import { cx } from "@/lib/utils"

export function IconButton({
  onClick,
  disabled,
  label,
  danger,
  children,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  danger?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-secondary-foreground text-sm transition",
        "hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40",
        danger && "hover:border-destructive/40 hover:text-destructive",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function FieldLabel({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string | null
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-secondary-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
      <div className="min-w-0">
        <Label className="text-sm text-foreground">{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function NativeSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="block w-full appearance-none rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-subtle disabled:text-muted-foreground"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
