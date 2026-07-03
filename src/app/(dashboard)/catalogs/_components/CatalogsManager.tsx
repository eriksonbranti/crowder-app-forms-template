"use client"

import { RiAddLine } from "@remixicon/react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import type { CatalogSource, Provider } from "@/lib/db/schema"
import { formatDateTime } from "@/lib/formatters"
import { CurrencyField } from "@/components/products/CurrencyField"

import { createCatalog } from "../actions"

type CatalogRow = {
  id: string
  title: string
  source: CatalogSource
  currency: string | null
  lastSyncedAt: string | null
}

type CredentialOption = { id: string; name: string; provider: Provider }

export function CatalogsManager({
  catalogs,
  credentials,
  supportedCurrencies,
}: {
  catalogs: CatalogRow[]
  credentials: CredentialOption[]
  supportedCurrencies: string[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [currency, setCurrency] = useState("")
  // "manual" o el id de una credencial (catálogo integrado 1:1, definition sección 13.1).
  const [sourceSel, setSourceSel] = useState<string>("manual")
  const [error, setError] = useState<string | null>(null)

  const isIntegrated = sourceSel !== "manual"
  const cred = credentials.find((c) => c.id === sourceSel)

  function resetForm() {
    setTitle("")
    setCurrency("")
    setSourceSel("manual")
    setError(null)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Catálogos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conjuntos de productos para usar en preguntas de tipo producto.
            Manual (vida propia) o integrado (sincronizado desde una conexión).
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <RiAddLine className="size-4" aria-hidden="true" /> Agregar
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Crear catálogo</DialogTitle>
              <DialogDescription>
                Manual (vida propia) o integrado (sincronizado desde una conexión).
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Merch Festival Aurora"
                />
              </div>
              <div className="space-y-1">
                <Label>Origen</Label>
                <Select value={sourceSel} onValueChange={setSourceSel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (vida propia)</SelectItem>
                    {credentials.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        Integrado · {c.name} ({c.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isIntegrated ? (
                <p className="text-xs text-muted-foreground">
                  La moneda la define el sync del proveedor; no se configura acá.
                </p>
              ) : (
                <div className="space-y-1">
                  <Label>Moneda</Label>
                  <CurrencyField
                    value={currency}
                    onChange={setCurrency}
                    supportedCurrencies={supportedCurrencies}
                    inputPlaceholder="ARS (configurá monedas en Settings)"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                isLoading={pending}
                disabled={pending || !title.trim()}
                onClick={() => {
                  setError(null)
                  startTransition(async () => {
                    const res = await createCatalog({
                      title,
                      source: (isIntegrated
                        ? cred!.provider
                        : "manual") as CatalogSource,
                      credentialId: isIntegrated ? sourceSel : null,
                      // La moneda de un catálogo integrado la trae el sync.
                      currency: isIntegrated ? null : currency.trim() || null,
                    })
                    if (res.ok) {
                      resetForm()
                      setOpen(false)
                    } else setError(res.error)
                  })
                }}
              >
                Crear catálogo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {catalogs.length === 0 ? (
        <Card className="bg-background">
          <p className="text-sm text-muted-foreground">
            Todavía no hay catálogos.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-background p-0">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Título</TableHeaderCell>
                  <TableHeaderCell>Origen</TableHeaderCell>
                  <TableHeaderCell>Moneda</TableHeaderCell>
                  <TableHeaderCell>Último sync</TableHeaderCell>
                  <TableHeaderCell className="text-right">Abrir</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalogs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">
                      {c.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.source === "manual" ? "neutral" : "default"}>
                        {c.source === "manual" ? "Manual" : c.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.currency ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/catalogs/${c.id}`}
                        className="text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        Ver detalle
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableRoot>
        </Card>
      )}
    </div>
  )
}
