import Link from "next/link"
import type { RemixiconComponentType } from "@remixicon/react"

import { cx } from "@/lib/utils"

export type TabItem = {
  key: string
  label: string
  href: string
  icon?: RemixiconComponentType
}

export function TabNav({ tabs, active }: { tabs: TabItem[]; active: string }) {
  return (
    <nav className="flex gap-0 border-b border-border" role="tablist">
      {tabs.map((t) => {
        const isActive = t.key === active
        const Icon = t.icon
        return (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={isActive}
            className={cx(
              "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-faint hover:text-secondary-foreground",
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden={true} />}
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
