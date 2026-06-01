"use client"

import { siteConfig } from "@/app/siteConfig"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSubMenu,
  DropdownMenuSubMenuContent,
  DropdownMenuSubMenuTrigger,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu"
import { cx, focusRing } from "@/lib/utils"
import { getBrowserSupabase } from "@/adapters/supabase/client"
import type { Session } from "@supabase/supabase-js"
import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import React from "react"

function DropdownUserProfile() {
  const [mounted, setMounted] = React.useState(false)
  const [email, setEmail] = React.useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  React.useEffect(() => {
    setMounted(true)
    const supabase = getBrowserSupabase()
    supabase.auth
      .getSession()
      .then(({ data }) => setEmail(data.session?.user?.email ?? null))
    const { data } = supabase.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        setEmail(session?.user?.email ?? null)
      },
    )
    return () => data.subscription.unsubscribe()
  }, [])

  if (!mounted) return null

  const initials = email ? email.slice(0, 2).toUpperCase() : "··"

  async function signOut() {
    const supabase = getBrowserSupabase()
    try {
      await supabase.auth.signOut({ scope: "local" })
    } finally {
      router.replace(siteConfig.baseLinks.login)
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="open user menu"
          className={cx(
            focusRing,
            "group rounded-full p-1 hover:bg-subtle data-[state=open]:bg-subtle",
          )}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-medium text-secondary-foreground"
            aria-hidden="true"
          >
            {initials}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="!min-w-[calc(var(--radix-dropdown-menu-trigger-width))]"
      >
        <DropdownMenuLabel>{email ?? "Sin sesión"}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuSubMenu>
            <DropdownMenuSubMenuTrigger>Tema</DropdownMenuSubMenuTrigger>
            <DropdownMenuSubMenuContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value)}
              >
                <DropdownMenuRadioItem value="light" iconType="check">
                  <RiSunLine className="size-4 shrink-0" aria-hidden="true" />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" iconType="check">
                  <RiMoonLine className="size-4 shrink-0" aria-hidden="true" />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" iconType="check">
                  <RiComputerLine
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubMenuContent>
          </DropdownMenuSubMenu>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={signOut}>Cerrar sesión</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { DropdownUserProfile }
