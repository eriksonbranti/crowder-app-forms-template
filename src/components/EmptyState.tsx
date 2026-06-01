import React from "react"
import { RiInboxLine, type RemixiconComponentType } from "@remixicon/react"

import { cx } from "@/lib/utils"

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: RemixiconComponentType
  title: React.ReactNode
  actions?: React.ReactNode
  compact?: boolean
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { icon: Icon = RiInboxLine, title, actions, compact = false, className, children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cx(
          "flex flex-col items-center rounded-lg border text-center",
          compact
            ? "gap-1 border-border bg-muted px-4 py-6"
            : "gap-2 border-dashed border-border bg-background px-6 py-10",
          className,
        )}
        {...props}
      >
        {!compact && (
          <span className="mb-1 inline-flex size-11 items-center justify-center rounded-full bg-subtle text-muted-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <p
          className={cx(
            "m-0 font-semibold text-foreground",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          {title}
        </p>
        {children && (
          <p className="m-0 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {children}
          </p>
        )}
        {actions && (
          <div
            className={cx(
              "flex flex-wrap justify-center gap-2",
              compact ? "mt-1" : "mt-1.5",
            )}
          >
            {actions}
          </div>
        )}
      </div>
    )
  },
)
EmptyState.displayName = "EmptyState"

export { EmptyState, type EmptyStateProps }
