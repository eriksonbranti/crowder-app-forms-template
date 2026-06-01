import Link from "next/link"

import { Button } from "@/components/Button"
import { PageError } from "@/components/PageError"

export default function DashboardNotFound() {
  return (
    <PageError
      code="404"
      title="No encontramos esta página"
      actions={
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      }
    >
      El recurso que buscás no existe o fue eliminado.
    </PageError>
  )
}
