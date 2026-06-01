import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/"
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error")

  const redirect = (path: string) => NextResponse.redirect(new URL(path, url.origin))

  if (errorParam) {
    return redirect(`/login?error=${encodeURIComponent(errorParam)}`)
  }

  if (!code) {
    return redirect(`/login?error=${encodeURIComponent("missing_code")}`)
  }

  const response = redirect(next)

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  return response
}
