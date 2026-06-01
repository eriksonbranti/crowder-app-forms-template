// Tremor Button [v0.2.0]

import { Slot } from "@radix-ui/react-slot"
import { RiLoader2Fill } from "@remixicon/react"
import React from "react"
import { tv, type VariantProps } from "tailwind-variants"

import { cx, focusRing } from "@/lib/utils"

const buttonVariants = tv({
  base: [
    // base
    "relative inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-sm transition-all duration-100 ease-in-out",
    // disabled
    "disabled:pointer-events-none disabled:shadow-none",
    // focus
    focusRing,
  ],
  variants: {
    variant: {
      primary: [
        "border-transparent",
        "text-primary-foreground",
        "bg-primary",
        "hover:bg-primary-hover",
        "disabled:bg-primary/40 disabled:text-primary-foreground/70",
      ],
      secondary: [
        "border-border",
        "text-foreground",
        "bg-background",
        "hover:bg-muted/60",
        "disabled:text-faint disabled:bg-muted/40",
      ],
      light: [
        "shadow-none",
        "border-transparent",
        "text-foreground",
        "bg-subtle",
        "hover:bg-accent",
        "disabled:bg-muted disabled:text-faint",
      ],
      ghost: [
        "shadow-none",
        "border-transparent",
        "text-foreground",
        "bg-transparent hover:bg-muted/60",
        "disabled:text-faint",
      ],
      destructive: [
        "text-destructive-foreground",
        "border-transparent",
        "bg-destructive",
        "hover:bg-destructive/90",
        "disabled:bg-destructive/30 disabled:text-destructive-foreground/70",
      ],
    },
  },
  defaultVariants: {
    variant: "primary",
  },
})

interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild,
      isLoading = false,
      loadingText,
      className,
      disabled,
      variant,
      children,
      ...props
    }: ButtonProps,
    forwardedRef,
  ) => {
    const Component = asChild ? Slot : "button"
    return (
      <Component
        ref={forwardedRef}
        className={cx(buttonVariants({ variant }), className)}
        disabled={disabled || isLoading}
        tremor-id="tremor-raw"
        {...props}
      >
        {isLoading ? (
          <span className="pointer-events-none flex shrink-0 items-center justify-center gap-1.5">
            <RiLoader2Fill
              className="animate-spin size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="sr-only">
              {loadingText ? loadingText : "Loading"}
            </span>
            {loadingText ? loadingText : children}
          </span>
        ) : (
          children
        )}
      </Component>
    )
  },
)

Button.displayName = "Button"

export { Button, buttonVariants, type ButtonProps }
