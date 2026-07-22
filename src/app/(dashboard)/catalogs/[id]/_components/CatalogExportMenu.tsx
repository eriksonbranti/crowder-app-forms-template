"use client"

import { RiDownloadLine } from "@remixicon/react"

import { Button } from "@/components/Button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu"
import type { ExportFormat } from "@/lib/export-table"

// Descarga reportes del catálogo: inventario (stock físico / reservado /
// disponible por variante) y vendidos (una fila por línea vendida con comprador
// y formulario). Ambos en CSV o Excel, reusando el patrón de export existente.
export function CatalogExportMenu({ catalogId }: { catalogId: string }) {
  const go = (report: "inventory" | "sales", format: ExportFormat) => {
    const params = new URLSearchParams({ format })
    window.location.href = `/api/admin/catalogs/${catalogId}/export-${report}?${params.toString()}`
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <RiDownloadLine className="size-4" aria-hidden="true" /> Exportar
          reportes
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Inventario</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => go("inventory", "csv")}>
          Inventario (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("inventory", "xlsx")}>
          Inventario (Excel)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Vendidos</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => go("sales", "csv")}>
          Vendidos (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("sales", "xlsx")}>
          Vendidos (Excel)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
