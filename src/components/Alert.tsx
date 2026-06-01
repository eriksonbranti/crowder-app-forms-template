import React from "react"
import { RiCloseLine } from "@remixicon/react"
import { tv, type VariantProps } from "tailwind-variants"

import { cx } from "@/lib/utils"
import { statusIcon, statusSurface } from "./_status-variants"

const alertVariants = tv({
  base: cx(
    "relative grid gap-x-3 rounded-md border p-3 text-sm",
    "[grid-template-columns:auto_1fr_auto]",
  ),
  variants: {
    variant: statusSurface,
  },
  defaultVariants: {
    variant: "info",
  },
})

interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode
  action?: React.ReactNode
  onDismiss?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, action, onDismiss, children, ...props }, ref) => {
    const Icon = statusIcon[variant ?? "info"]
    return (
      <div
        ref={ref}
        role={variant === "error" ? "alert" : "status"}
        className={cx(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          {title && <p className="font-semibold leading-snug">{title}</p>}
          {children && (
            <div className="text-[13px] leading-snug opacity-90">{children}</div>
          )}
        </div>
        {(action || onDismiss) && (
          <div className="flex items-start gap-2">
            {action}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Cerrar"
                className="rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <RiCloseLine className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  },
)
Alert.displayName = "Alert"

export { Alert, alertVariants, type AlertProps }
