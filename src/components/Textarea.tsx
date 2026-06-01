// Tremor Textarea [v0.0.2]

import React from "react"

import { cx, focusInput, hasErrorInput } from "@/lib/utils"

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }: TextareaProps, forwardedRef) => {
    return (
      <textarea
        ref={forwardedRef}
        className={cx(
          // base
          "flex min-h-[4rem] w-full rounded-md border px-3 py-1.5 shadow-sm outline-none transition-colors sm:text-sm",
          // text color
          "text-foreground",
          // border color
          "border-border",
          // background color
          "bg-background",
          // placeholder color
          "placeholder:text-faint",
          // disabled
          "disabled:border-border disabled:bg-subtle disabled:text-muted-foreground",
          // focus
          focusInput,
          // error
          hasError ? hasErrorInput : "",
          // invalid (optional)
          // "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20 aria-[invalid=true]:border-destructive invalid:ring-2 invalid:ring-red-200 invalid:border-red-500"
          className,
        )}
        tremor-id="tremor-raw"
        {...props}
      />
    )
  },
)

Textarea.displayName = "Textarea"

export { Textarea, type TextareaProps }
