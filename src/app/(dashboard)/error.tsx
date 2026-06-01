"use client"

import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@/components/Button"
import { PageError } from "@/components/PageError"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageError
      code="500"
      title="Algo salió mal"
      requestId={error.digest}
      actions={
        <>
          <Button onClick={reset}>Reintentar</Button>
          <Button variant="secondary" asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </>
      }
    >
      Ocurrió un error inesperado al cargar esta sección. Probá de nuevo en unos
      segundos.
    </PageError>
  )
}
