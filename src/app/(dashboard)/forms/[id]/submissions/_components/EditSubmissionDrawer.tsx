"use client"

import { useEffect, useState, useTransition } from "react"

import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { FormRenderer } from "@/components/form-renderer/FormRenderer"
import type { FormGroup } from "@/lib/db/schema"
import type { RenderProduct } from "@/lib/products/types"

import { editSubmissionAction } from "../actions"

export function EditSubmissionDrawer({
  submissionId,
  initialAnswers,
  onClose,
}: {
  submissionId: string
  initialAnswers: Record<string, unknown>
  onClose: () => void
}) {
  const [group, setGroup] = useState<FormGroup | null>(null)
  const [productLists, setProductLists] = useState<
    Record<string, RenderProduct[]>
  >({})
  const [reason, setReason] = useState("")
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    fetch(`/api/admin/submissions/${submissionId}/form`)
      .then((r) => r.json())
      .then((data) => {
        setGroup(data.group)
        setProductLists(data.productLists ?? {})
      })
      .catch(() => setServerError("No se pudo cargar el form"))
  }, [submissionId])

  function handleSubmit(answers: Record<string, unknown>) {
    setServerError(null)
    startTransition(async () => {
      const res = await editSubmissionAction({
        submissionId,
        answers,
        reason: reason.trim() || null,
      })
      if (!res.ok) {
        setServerError(res.error.message)
        return
      }
      onClose()
    })
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="sm:max-w-xl">
        <DrawerHeader>
          <DrawerTitle>Editar respuesta</DrawerTitle>
          <DrawerDescription>
            Se guarda el cambio + un audit log con el valor anterior y el nuevo.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {!group ? (
            <p className="text-sm text-muted-foreground">
              {serverError ?? "Cargando…"}
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-reason">Motivo del cambio (opcional)</Label>
                <Input
                  id="edit-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Corrige talle, error de tipeo, etc."
                />
              </div>
              <FormRenderer
                group={group}
                initialAnswers={initialAnswers}
                onSubmit={handleSubmit}
                submitLabel={pending ? "Guardando…" : "Guardar cambio"}
                productLists={productLists}
              />
              {serverError && (
                <p className="text-sm text-destructive">{serverError}</p>
              )}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
