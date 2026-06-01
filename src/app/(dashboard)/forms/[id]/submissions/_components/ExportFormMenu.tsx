"use client"

import { RiDownloadLine } from "@remixicon/react"

import { Button } from "@/components/Button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu"
import type { ExportFormat } from "@/lib/export-table"

export function ExportFormMenu({
  formId,
  eventId,
  search,
}: {
  formId: string
  eventId?: number
  search?: string
}) {
  const href = (format: ExportFormat) => {
    const params = new URLSearchParams({ formId, format })
    if (eventId !== undefined) params.set("eventId", String(eventId))
    if (search) params.set("q", search)
    return `/api/admin/submissions/export-form?${params.toString()}`
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <RiDownloadLine className="size-4" aria-hidden="true" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            window.location.href = href("csv")
          }}
        >
          Descargar CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            window.location.href = href("xlsx")
          }}
        >
          Descargar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
