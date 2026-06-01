import React from "react"
import { RiCloseLine, RiLoader2Fill } from "@remixicon/react"

import { cx } from "@/lib/utils"
import {
  statusIcon,
  statusIconColor,
  type StatusVariant,
} from "./_status-variants"

type ToastVariant = StatusVariant

interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: ToastVariant
  title?: React.ReactNode
  loading?: boolean
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    { className, variant = "neutral", title, loading, action, onDismiss, children, ...props },
    ref,
  ) => {
    const Icon = loading ? RiLoader2Fill : statusIcon[variant]
    return (
      <div
        ref={ref}
        role={variant === "error" ? "alert" : "status"}
        className={cx(
          "grid min-w-[320px] max-w-[380px] grid-cols-[20px_1fr_auto] items-start gap-x-3 rounded-lg border border-border bg-popover px-3.5 py-3 text-[13px] leading-snug text-popover-foreground shadow-xl shadow-black/[2.5%]",
          className,
        )}
        {...props}
      >
        <Icon
          className={cx(
            "mt-0.5 size-[18px] shrink-0",
            loading ? "animate-spin text-muted-foreground" : statusIconColor[variant],
          )}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          {title && <p className="m-0 text-[13px] font-semibold">{title}</p>}
          {children && (
            <p className="m-0 text-xs text-muted-foreground">{children}</p>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-1 cursor-pointer self-start border-0 bg-transparent p-0 text-xs font-medium text-foreground underline underline-offset-[3px]"
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            className="cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <RiCloseLine className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  },
)
Toast.displayName = "Toast"

export { Toast, type ToastProps }
