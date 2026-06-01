"use client"

import { useMemo } from "react"

import { renderMarkdownLite } from "@/lib/form-schema"

export function MarkdownLite({
  children,
  className,
  as: Tag = "span",
}: {
  children: string
  className?: string
  as?: keyof React.JSX.IntrinsicElements
}) {
  const html = useMemo(() => renderMarkdownLite(children), [children])
  return (
    <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
  )
}
