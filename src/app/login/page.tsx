"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  RiFileList3Line,
  RiInboxLine,
  RiLock2Line,
  RiMailLine,
  RiMailSendLine,
  RiShieldCheckLine,
  type RemixiconComponentType,
} from "@remixicon/react"

import { Logo } from "../../../public/Logo"
import { Alert } from "@/components/Alert"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { getBrowserSupabase } from "@/adapters/supabase/client"
import { cx } from "@/lib/utils"

type Mode = "magic" | "password"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function mapAuthError(message: string, mode: Mode): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Mail o contraseña incorrectos."
  }
  if (m.includes("email not confirmed")) {
    return "Confirmá tu mail antes de ingresar."
  }
  if (m.includes("rate limit") || m.includes("for security purposes")) {
    return "Demasiados intentos. Probá de nuevo en unos minutos."
  }
  if (m.includes("network") || m.includes("failed to fetch")) {
    return "No pudimos conectarnos. Revisá tu red y reintentá."
  }
  return mode === "password"
    ? "No pudimos ingresarte. Probá de nuevo."
    : "No pudimos enviar el link. Probá de nuevo."
}

function LoginInner() {
  const [mode, setMode] = useState<Mode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const urlError = searchParams.get("error")
  useEffect(() => {
    if (urlError) {
      setStatus("error")
      setErrorMessage(mapAuthError(urlError, mode))
    }
    // mode intentionally omitted: switching tabs should not re-surface a dismissed URL error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlError])

  function switchMode(next: Mode) {
    setMode(next)
    setStatus("idle")
    setErrorMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setErrorMessage(null)

    const supabase = getBrowserSupabase()

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setStatus("error")
        setErrorMessage(mapAuthError(error.message, mode))
        return
      }
      const next = searchParams.get("next") ?? "/"
      window.location.assign(next)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setStatus("error")
      setErrorMessage(mapAuthError(error.message, mode))
      return
    }
    setStatus("sent")
  }

  const sent = status === "sent" && mode === "magic"
  const sending = status === "sending"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,560px)_1fr]">
        <main className="relative flex flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
          <div className="flex flex-1 items-center justify-center py-6">
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
              <div className="flex items-center">
                <Logo className="h-7 w-auto" />
              </div>

              {sent ? (
                <SentView email={email} onChangeEmail={() => setStatus("idle")} />
              ) : (
                <>
                  <div className="mt-8 space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                      Iniciá sesión
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Accedé al panel para gestionar los formularios de tu evento.
                    </p>
                  </div>

                  <div
                    role="tablist"
                    aria-label="Método de acceso"
                    className="mt-6 inline-flex rounded-md border border-border bg-muted/40 p-0.5"
                  >
                    <MethodTab
                      active={mode === "password"}
                      onClick={() => switchMode("password")}
                    >
                      Contraseña
                    </MethodTab>
                    <MethodTab
                      active={mode === "magic"}
                      onClick={() => switchMode("magic")}
                    >
                      Magic link
                    </MethodTab>
                  </div>

                  {errorMessage && (
                    <div className="mt-4">
                      <Alert variant="error">{errorMessage}</Alert>
                    </div>
                  )}

                  <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <RiMailLine
                          className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          id="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="vos@tuevento.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          hasError={
                            status === "error" && mode === "password"
                          }
                          inputClassName="pl-8"
                        />
                      </div>
                      {mode === "magic" && (
                        <p className="text-xs text-muted-foreground">
                          Te mandamos un link de acceso a este correo.
                        </p>
                      )}
                    </div>

                    {mode === "password" && (
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <Label htmlFor="password">Contraseña</Label>
                          <a
                            href="#"
                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            ¿Olvidaste?
                          </a>
                        </div>
                        <div className="relative">
                          <RiLock2Line
                            className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            hasError={status === "error"}
                            inputClassName="pl-8"
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={sending}
                      isLoading={sending}
                      loadingText={
                        mode === "magic" ? "Enviando link…" : "Iniciando sesión…"
                      }
                    >
                      {mode === "magic" ? "Enviarme un link" : "Iniciar sesión"}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <span className="font-mono">crowder-app-forms-template</span>
          </div>
        </main>

        <aside className="relative hidden flex-col justify-center border-l border-border bg-muted/60 px-12 py-12 lg:flex">
          <div className="max-w-md space-y-6">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Crowder Apps: Forms
            </div>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
              Gestioná los formularios de tu evento desde un solo lugar.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Diseñá formularios, mirá respuestas y exportá transacciones. Todo
              conectado al checkout de Crowder.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-2">
              <FeatureRow
                Icon={RiFileList3Line}
                title="Formularios versionados"
                caption="Borrador, publicado, archivado."
              />
              <FeatureRow
                Icon={RiInboxLine}
                title="Respuestas en vivo"
                caption="Sincronizadas con cada transaction."
              />
              <FeatureRow
                Icon={RiShieldCheckLine}
                title="Datos seguros"
                caption="RLS en Postgres, lifecycle firmado."
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function MethodTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "whitespace-nowrap rounded-[5px] px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function FeatureRow({
  Icon,
  title,
  caption,
}: {
  Icon: RemixiconComponentType
  title: string
  caption: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background px-3.5 py-3 shadow-sm">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden={true} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-balance text-sm font-medium leading-snug text-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {caption}
        </p>
      </div>
    </div>
  )
}

function SentView({
  email,
  onChangeEmail,
}: {
  email: string
  onChangeEmail: () => void
}) {
  return (
    <div className="mt-8 space-y-6">
      <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
        <RiMailSendLine className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">
          Revisá tu correo
        </h1>
        <p className="text-sm text-muted-foreground">
          Te mandamos un link de acceso a{" "}
          <span className="font-medium text-foreground">{email}</span>. El link
          tiene una validez de 15 minutos.
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        ¿No te llegó? Revisá la carpeta de spam o{" "}
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          probá con otro email
        </button>
        .
      </div>
    </div>
  )
}
