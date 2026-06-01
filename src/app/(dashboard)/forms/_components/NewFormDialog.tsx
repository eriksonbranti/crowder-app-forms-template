"use client"

import { RiAddLine } from "@remixicon/react"
import { useActionState, useState } from "react"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"

import { createFormAction, type ActionResult } from "../actions"

export function NewFormDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createFormAction,
    null,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <RiAddLine className="size-4" aria-hidden="true" /> Crear formulario
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Nuevo formulario</DialogTitle>
            <DialogDescription>
              Empezás con un grupo y una pregunta. Podés editar todo después.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                name="title"
                placeholder="Inscripción Maratón"
                required
              />
              <p className="text-xs text-muted-foreground">
                El slug (ID) se genera automáticamente a partir del título.
              </p>
              {state?.fieldErrors?.title && (
                <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
              )}
            </div>
            {state?.ok === false && !state.fieldErrors && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={pending}>
              Crear borrador
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
