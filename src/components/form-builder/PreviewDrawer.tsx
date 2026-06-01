"use client"

import { useMemo } from "react"

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { EmbedWizard } from "@/components/embed/EmbedWizard"
import type { IframeContext } from "@/components/embed/types"
import type { FormDefinition, FormTheme, ItemSnapshot } from "@/lib/db/schema"
import { embedThemeStyle } from "@/lib/theme"

export function PreviewDrawer({
  open,
  onOpenChange,
  formId,
  definition,
  title,
  theme,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  definition: FormDefinition
  title: string
  theme: FormTheme | null
}) {
  const hasItemGroup = useMemo(
    () => definition.groups.some((g) => g.scope === "item"),
    [definition],
  )

  // Two items only when the form needs per-item answers — keeps the stepper
  // visible without bloating navigation. Purchase-only forms get an empty list
  // (those steps are item-agnostic anyway).
  const previewContext = useMemo<IframeContext>(
    () => ({
      locale: "es-AR",
      currency: "ARS",
      eventInfo: { id: 0, name: "Evento de prueba" },
      items: hasItemGroup ? PREVIEW_ITEMS : [],
      user: PREVIEW_USER,
      completion: { required: false },
    }),
    [hasItemGroup],
  )

  const themeCss = embedThemeStyle(theme)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background">
        <DrawerHeader>
          <DrawerTitle>Vista previa: {title}</DrawerTitle>
          <p className="text-xs text-muted-foreground">
            Reproducimos el wizard del checkout con datos de muestra.
          </p>
        </DrawerHeader>
        {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
        {definition.groups.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            Agregá al menos un grupo para previsualizar.
          </p>
        ) : (
          <EmbedWizard
            key={`${formId}-${hasItemGroup ? "items" : "no-items"}`}
            forms={[
              {
                id: formId,
                title,
                version: 0,
                definition,
              },
            ]}
            supportedCurrencies={[]}
            parentOrigins={[]}
            formIdForDiagnostics={formId}
            previewContext={previewContext}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

const PREVIEW_USER = {
  email: "fan@example.com",
  firstName: "Camila",
  lastName: "Pérez",
  country: "AR",
}

const PREVIEW_ITEMS: ItemSnapshot[] = [
  {
    uuid: "preview-item-1111-2222-aaaa",
    show: "Show de muestra",
    sectorName: "Platea baja",
    rateName: "General",
    sectionName: "A",
    row: "5",
    seat: "12",
    quantity: 1,
    price: 25000,
    holder: {
      firstName: "Camila",
      lastName: "Pérez",
      documentType: "DNI",
      documentNumber: "30123456",
    },
  },
  {
    uuid: "preview-item-3333-4444-bbbb",
    show: "Show de muestra",
    sectorName: "Platea baja",
    rateName: "General",
    sectionName: "A",
    row: "5",
    seat: "13",
    quantity: 1,
    price: 25000,
    holder: null,
  },
]
