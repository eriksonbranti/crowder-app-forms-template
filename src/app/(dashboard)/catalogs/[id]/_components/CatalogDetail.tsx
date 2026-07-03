"use client"

import { RiAddLine } from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"

import { downloadJson } from "@/lib/download"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Checkbox } from "@/components/Checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { CurrencyField } from "@/components/products/CurrencyField"
import { formatPrice, priceRange } from "@/lib/products/format"
import { cx } from "@/lib/utils"
import type {
  CatalogSource,
  ProductOption,
  ProductStatus,
  ProductVariant,
  SyncState,
} from "@/lib/db/schema"
import { formatDateTime } from "@/lib/formatters"

import {
  createCollection,
  deleteCatalog,
  deleteCollection,
  importProducts,
  runSync,
  setCollectionProducts,
  updateCatalog,
  updateCollection,
} from "../../actions"

type CollectionRow = { id: string; title: string; externalId: string | null }
type ProductRow = {
  id: string
  title: string
  status: ProductStatus
  currency: string | null
  images: string[]
  imageUrl: string | null
  refundable: boolean
  externalId: string | null
  options: ProductOption[] | null
  variants: ProductVariant[]
  collectionIds: string[]
}

// Rango de precios del producto a partir de sus variantes (las variantes pueden
// diferir en precio por talla). Devuelve null si ninguna variante tiene precio.
function priceSummary(p: ProductRow): string | null {
  const range = priceRange(p.variants)
  if (!range) return null
  return range.lo === range.hi
    ? formatPrice(range.lo, p.currency)
    : `${formatPrice(range.lo, p.currency)} – ${formatPrice(range.hi, p.currency)}`
}

// Resumen de stock: suma de las variantes con control de stock. null si ninguna
// lo controla (todas ilimitadas).
function stockSummary(p: ProductRow): number | null {
  const tracked = p.variants.filter((v) => v.stockTracked)
  if (tracked.length === 0) return null
  return tracked.reduce((n, v) => n + (v.stock ?? 0), 0)
}

export function CatalogDetail({
  catalog,
  collections,
  products,
  supportedCurrencies,
}: {
  catalog: {
    id: string
    title: string
    source: CatalogSource
    currency: string | null
    syncState: SyncState | null
  }
  collections: CollectionRow[]
  products: ProductRow[]
  supportedCurrencies: string[]
}) {
  const router = useRouter()
  const isManual = catalog.source === "manual"
  const [pending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [tab, setTab] = useState<"collections" | "products">("collections")
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [ioMsg, setIoMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const collectionTitleById = useMemo(
    () => new Map(collections.map((c) => [c.id, c.title])),
    [collections],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(catalog.title)
  const [editCurrency, setEditCurrency] = useState(catalog.currency ?? "")
  const [editError, setEditError] = useState<string | null>(null)

  // Export: descarga los productos como JSON re-importable (shape editable, sin
  // ids internos). Import: agrega los del archivo (aditivo), ver actions.importProducts.
  function handleExport() {
    setIoMsg(null)
    const clean = products.map((p) => ({
      title: p.title,
      currency: p.currency,
      images: p.images,
      status: p.status,
      refundable: p.refundable,
      options: p.options,
      variants: p.variants.map((v) => ({
        options: v.options,
        title: v.title,
        sku: v.sku,
        price: v.price,
        images: v.images,
        stockTracked: v.stockTracked,
        stock: v.stock,
        oversellPolicy: v.oversellPolicy,
      })),
      collectionIds: p.collectionIds,
    }))
    downloadJson(
      `${catalog.id.replace(/[^a-z0-9_-]+/gi, "_")}.products.json`,
      clean,
    )
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setIoMsg(null)
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setIoMsg({ kind: "error", text: "JSON inválido." })
      return
    }
    const count = Array.isArray(raw) ? raw.length : 0
    if (!count) {
      setIoMsg({ kind: "error", text: "El archivo no tiene productos (se espera un array)." })
      return
    }
    if (!confirm(`Importar ${count} producto(s) del archivo "${file.name}"? Se agregan a los existentes.`))
      return
    startTransition(async () => {
      const res = await importProducts(catalog.id, raw)
      if (res.ok)
        setIoMsg({
          kind: "ok",
          text: `Importados ${res.value.created}${res.value.failed ? `, ${res.value.failed} con error` : ""}.`,
        })
      else setIoMsg({ kind: "error", text: res.error })
    })
  }

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {catalog.title}
            </h1>
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setEditTitle(catalog.title)
                setEditCurrency(catalog.currency ?? "")
                setEditError(null)
                setEditOpen(true)
              }}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-red-600"
              onClick={() => {
                if (
                  !confirm(
                    `¿Eliminar el catálogo "${catalog.title}"? Se archivan también sus colecciones y productos.`,
                  )
                )
                  return
                setDeleteError(null)
                startTransition(async () => {
                  const res = await deleteCatalog(catalog.id)
                  if (res.ok) router.push("/catalogs")
                  else setDeleteError(res.error)
                })
              }}
            >
              Eliminar
            </Button>
          </div>
          {deleteError && (
            <p className="mt-1 text-sm text-red-600">{deleteError}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            <Badge variant={isManual ? "neutral" : "default"}>
              {isManual ? "Manual" : catalog.source}
            </Badge>{" "}
            {catalog.currency ?? "sin moneda"}
          </p>
        </div>
        {!isManual && (
          <div className="text-right">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setSyncMsg("Sincronizando…")
                  const res = await runSync(catalog.id)
                  if (res.ok) {
                    const c = res.value.counts as SyncState["counts"]
                    setSyncMsg(
                      `Sync ${res.value.status}: ${c.upserted} actualizados, ${c.archived} archivados${res.value.errors.length ? `, ${res.value.errors.length} errores` : ""}`,
                    )
                  } else setSyncMsg(res.error)
                })
              }
            >
              Sincronizar ahora
            </Button>
            {syncMsg && (
              <p className="mt-2 max-w-xs text-xs text-muted-foreground">{syncMsg}</p>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditError(null)
        }}
      >
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Editar catálogo</DialogTitle>
            <DialogDescription>
              El origen ({isManual ? "manual" : catalog.source}) no se puede cambiar.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Merch Festival Aurora"
              />
            </div>
            {isManual ? (
              <div className="space-y-1">
                <Label>Moneda</Label>
                <CurrencyField
                  value={editCurrency}
                  onChange={setEditCurrency}
                  supportedCurrencies={supportedCurrencies}
                  noneLabel="Sin definir"
                  inputPlaceholder="ARS (configurá monedas en Settings)"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                La moneda ({catalog.currency ?? "sin definir"}) la define el sync
                del proveedor; no se edita acá.
              </p>
            )}

            {editError && <p className="text-sm text-red-600">{editError}</p>}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              isLoading={pending}
              disabled={pending || !editTitle.trim()}
              onClick={() => {
                setEditError(null)
                startTransition(async () => {
                  const res = await updateCatalog(catalog.id, {
                    title: editTitle.trim(),
                    // Integrado: la moneda la fija el sync, no se manda.
                    ...(isManual
                      ? { currency: editCurrency.trim() || null }
                      : {}),
                  })
                  if (res.ok) setEditOpen(false)
                  else setEditError(res.error)
                })
              }}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {catalog.syncState && (
        <Card className="bg-background text-xs text-muted-foreground">
          Último sync: {formatDateTime(catalog.syncState.lastRunAt)} ·{" "}
          {catalog.syncState.counts.fetched} traídos · {catalog.syncState.counts.upserted} upserts ·{" "}
          {catalog.syncState.counts.archived} archivados
          {catalog.syncState.errors.length > 0 && (
            <span className="text-red-600"> · {catalog.syncState.errors.length} errores</span>
          )}
        </Card>
      )}

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["collections", "Colecciones"],
            ["products", "Productos"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="ml-2 text-xs text-muted-foreground">
              {key === "collections" ? collections.length : products.length}
            </span>
          </button>
        ))}
      </div>

      {tab === "collections" && (
        <CollectionsSection
          catalogId={catalog.id}
          collections={collections}
          products={products}
          isManual={isManual}
          pending={pending}
          startTransition={startTransition}
        />
      )}

      {tab === "products" && (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Productos</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={products.length === 0}
              onClick={handleExport}
            >
              Exportar JSON
            </Button>
            {isManual && (
              <>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => importInputRef.current?.click()}
                >
                  Importar JSON
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button variant="secondary" asChild>
                  <Link href={`/catalogs/${catalog.id}/products/new`}>
                    Nuevo producto
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
        {ioMsg && (
          <p
            className={cx(
              "text-xs",
              ioMsg.kind === "ok" ? "text-emerald-600" : "text-red-600",
            )}
          >
            {ioMsg.text}
          </p>
        )}
        {products.length === 0 ? (
          <Card className="bg-background">
            <p className="text-sm text-muted-foreground">
              {isManual
                ? "Todavía no hay productos. Creá el primero."
                : "Sin productos. Ejecutá un sync para traerlos."}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden bg-background p-0">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Producto</TableHeaderCell>
                    <TableHeaderCell>Variantes</TableHeaderCell>
                    <TableHeaderCell>Precio</TableHeaderCell>
                    <TableHeaderCell>Stock</TableHeaderCell>
                    <TableHeaderCell>Colecciones</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Acción
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => {
                    const price = priceSummary(p)
                    const stock = stockSummary(p)
                    const collectionNames = p.collectionIds
                      .map((id) => collectionTitleById.get(id))
                      .filter((t): t is string => Boolean(t))
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.imageUrl}
                                alt=""
                                className="size-10 shrink-0 rounded-md border border-border object-cover"
                              />
                            ) : (
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[9px] text-muted-foreground">
                                sin foto
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {p.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.refundable ? "Con devolución" : "Sin devolución"}
                                {p.externalId ? " · sincronizado" : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.variants.length}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {price ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {stock != null ? stock : "Ilimitado"}
                        </TableCell>
                        <TableCell>
                          {collectionNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {collectionNames.map((name) => (
                                <Badge key={name} variant="neutral">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={p.status === "active" ? "success" : "neutral"}
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/catalogs/${catalog.id}/products/${p.id}`}
                            className="text-xs text-muted-foreground transition hover:text-foreground"
                          >
                            {isManual ? "Editar" : "Ver"}
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableRoot>
          </Card>
        )}
      </div>
      )}
    </main>
  )
}

// ─── Colecciones ──────────────────────────────────────────────────────────

function CollectionsSection({
  catalogId,
  collections,
  products,
  isManual,
  pending,
  startTransition,
}: {
  catalogId: string
  collections: CollectionRow[]
  products: ProductRow[]
  isManual: boolean
  pending: boolean
  startTransition: (cb: () => void) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [managing, setManaging] = useState<CollectionRow | null>(null)
  const [renaming, setRenaming] = useState<CollectionRow | null>(null)

  const countByCollection = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products)
      for (const id of p.collectionIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    return counts
  }, [products])

  const submitAdd = () => {
    setError(null)
    startTransition(async () => {
      const res = await createCollection({ catalogId, title })
      if (res.ok) {
        setTitle("")
        setAddOpen(false)
      } else setError(res.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Colecciones</h2>
        {isManual && (
          <Dialog
            open={addOpen}
            onOpenChange={(o) => {
              setAddOpen(o)
              if (!o) {
                setTitle("")
                setError(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <RiAddLine className="size-4" aria-hidden="true" /> Nueva colección
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Nueva colección</DialogTitle>
                <DialogDescription>
                  Agrupá productos del catálogo (ej: Remeras, Gorras).
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-1">
                <Label>Título</Label>
                <Input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Remeras"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim() && !pending) {
                      e.preventDefault()
                      e.currentTarget.blur()
                      submitAdd()
                    }
                  }}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAddOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  isLoading={pending}
                  disabled={pending || !title.trim()}
                  onClick={submitAdd}
                >
                  Crear colección
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {collections.length === 0 ? (
        <Card className="bg-background">
          <p className="text-sm text-muted-foreground">
            {isManual
              ? "Todavía no hay colecciones. Creá la primera."
              : "Sin colecciones. Ejecutá un sync para traerlas."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-background p-0">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Colección</TableHeaderCell>
                  <TableHeaderCell>Productos</TableHeaderCell>
                  <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {collections.map((c) => {
                  const canEdit = isManual && !c.externalId
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">{c.title}</span>{" "}
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {c.id}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {countByCollection.get(c.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit ? (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setManaging(c)}
                              className="text-xs text-muted-foreground transition hover:text-foreground"
                            >
                              Agregar productos
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenaming(c)}
                              className="text-xs text-muted-foreground transition hover:text-foreground"
                            >
                              Renombrar
                            </button>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground transition hover:text-red-600"
                              onClick={() => {
                                if (!confirm(`¿Eliminar la colección "${c.title}"?`)) return
                                startTransition(async () => {
                                  await deleteCollection(c.id, catalogId)
                                })
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableRoot>
        </Card>
      )}

      {managing && (
        <ManageCollectionProductsDrawer
          catalogId={catalogId}
          collection={managing}
          products={products}
          startTransition={startTransition}
          onClose={() => setManaging(null)}
        />
      )}

      {renaming && (
        <RenameCollectionDialog
          catalogId={catalogId}
          collection={renaming}
          pending={pending}
          startTransition={startTransition}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  )
}

// Dialog para renombrar una colección manual (actions.updateCollection).
function RenameCollectionDialog({
  catalogId,
  collection,
  pending,
  startTransition,
  onClose,
}: {
  catalogId: string
  collection: CollectionRow
  pending: boolean
  startTransition: (cb: () => void) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(collection.title)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const next = title.trim()
    if (!next || next === collection.title) return onClose()
    setError(null)
    startTransition(async () => {
      const res = await updateCollection(collection.id, catalogId, { title: next })
      if (res.ok) onClose()
      else setError(res.error)
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>Renombrar colección</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-1">
          <Label>Título</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim() && !pending) {
                e.preventDefault()
                e.currentTarget.blur()
                submit()
              }
            }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button isLoading={pending} disabled={pending || !title.trim()} onClick={submit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Drawer para asignar/quitar productos de una colección. La selección es local y
// optimista (cada toggle es instantáneo, sin congelar la lista ni pegarle al
// server). Al guardar persiste el set completo de una vez con setCollectionProducts.
function ManageCollectionProductsDrawer({
  catalogId,
  collection,
  products,
  startTransition,
  onClose,
}: {
  catalogId: string
  collection: CollectionRow
  products: ProductRow[]
  startTransition: (cb: () => void) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        products.filter((p) => p.collectionIds.includes(collection.id)).map((p) => p.id),
      ),
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? products.filter((p) => p.title.toLowerCase().includes(q)) : products
  }, [products, query])

  const dirty = useMemo(
    () =>
      products.some(
        (p) => p.collectionIds.includes(collection.id) !== selected.has(p.id),
      ),
    [products, collection.id, selected],
  )

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAllFiltered = () =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id))
      else filtered.forEach((p) => next.add(p.id))
      return next
    })

  const save = () => {
    if (!dirty) return onClose()
    setError(null)
    setSaving(true)
    startTransition(async () => {
      const res = await setCollectionProducts(collection.id, catalogId, [...selected])
      if (res.ok) onClose()
      else {
        setError(res.error)
        setSaving(false)
      }
    })
  }

  return (
    <Drawer open onOpenChange={(o) => !o && !saving && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Productos en "{collection.title}"</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay productos en el catálogo. Creá productos en la pestaña Productos.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar producto…"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={toggleAllFiltered}
                    disabled={filtered.length === 0}
                    className="font-medium text-foreground transition hover:underline disabled:opacity-50"
                  >
                    {allFilteredSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                    {query.trim() ? " (filtrados)" : ""}
                  </button>
                  <span>{selected.size} seleccionado(s)</span>
                </div>
              </div>
              {filtered.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  Ningún producto coincide con "{query.trim()}".
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <label className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-subtle/50">
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggle(p.id)}
                        />
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-8 shrink-0 rounded border border-border object-cover"
                          />
                        ) : null}
                        <span className="truncate font-medium text-foreground">{p.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button isLoading={saving} disabled={saving} onClick={save}>
            {dirty ? "Guardar" : "Listo"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
