"use client"

import { siteConfig } from "@/app/siteConfig"
import { cx, focusRing } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "../../../public/Logo"
import { DropdownUserProfile } from "./UserProfile"

const navItems = [
  { href: siteConfig.baseLinks.overview, label: "Overview" },
  { href: siteConfig.baseLinks.forms, label: "Formularios" },
  { href: siteConfig.baseLinks.transactions, label: "Transacciones" },
  { href: siteConfig.baseLinks.webhooks, label: "Webhooks" },
  { href: siteConfig.baseLinks.settings, label: "Settings" },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

function Navigation() {
  const pathname = usePathname()
  return (
    <div className="shadow-s sticky top-0 z-20 bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 pt-3">
        <div>
          <span className="sr-only">Crowder Partner Forms</span>
          <Logo className="h-6" />
        </div>
        <div className="flex h-[42px] flex-nowrap gap-1">
          <DropdownUserProfile />
        </div>
      </div>
      <nav className="mt-5 border-b border-border">
        <ul className="mx-auto flex w-full max-w-7xl items-center px-6">
          {navItems.map((it) => {
            const active = isActive(pathname, it.href)
            return (
              <li key={it.href} className="flex">
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex items-center justify-center whitespace-nowrap border-b-2 px-3 pb-2 text-sm font-medium transition-all",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-faint hover:text-secondary-foreground",
                    focusRing,
                  )}
                >
                  {it.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

export { Navigation }
