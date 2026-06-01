import React from "react"
import { RiCloseLine } from "@remixicon/react"
import { tv, type VariantProps } from "tailwind-variants"

import { cx } from "@/lib/utils"
import { statusIcon, statusIconColor, statusSurface } from "./_status-variants"

const bannerVariants = tv({
  base: "flex items-center gap-3 border-y px-4 py-2.5 text-[13px]",
  variants: {
    variant: statusSurface,
  },
  defaultVariants: { variant: "warning" },
})

type BannerVariant = NonNullable<VariantProps<typeof bannerVariants>["variant"]>

interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof bannerVariants> {
  title?: React.ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  ({ className, variant, title, action, onDismiss, children, ...props }, ref) => {
    const v: BannerVariant = variant ?? "warning"
    const Icon = statusIcon[v]
    return (
      <div
        ref={ref}
        role="status"
        className={cx(bannerVariants({ variant }), className)}
        {...props}
      >
        <Icon
          className={cx("size-4 shrink-0", statusIconColor[v])}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
          {title && <span className="font-semibold">{title}</span>}
          {children && <span className="opacity-90">{children}</span>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-inherit underline underline-offset-[3px]"
          >
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            className="cursor-pointer rounded-sm p-0.5 text-inherit opacity-70 transition hover:opacity-100"
          >
            <RiCloseLine className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  },
)
Banner.displayName = "Banner"

export { Banner, bannerVariants, type BannerProps }
