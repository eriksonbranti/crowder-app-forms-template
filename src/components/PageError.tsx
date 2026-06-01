import React from "react"

import { cx } from "@/lib/utils"

interface PageErrorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  code?: string
  title: React.ReactNode
  actions?: React.ReactNode
  requestId?: string
}

const PageError = React.forwardRef<HTMLDivElement, PageErrorProps>(
  ({ className, code, title, actions, requestId, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cx(
          "flex min-h-[320px] flex-col items-start gap-4 rounded-lg border border-border bg-background px-10 py-14",
          className,
        )}
        {...props}
      >
        {code && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {code}
          </span>
        )}
        <h2 className="m-0 text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        {children && (
          <p className="m-0 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {children}
          </p>
        )}
        {actions && <div className="mt-1 flex gap-2">{actions}</div>}
        {requestId && (
          <p className="m-0 font-mono text-[11px] text-faint">
            request_id · {requestId}
          </p>
        )}
      </div>
    )
  },
)
PageError.displayName = "PageError"

export { PageError, type PageErrorProps }
