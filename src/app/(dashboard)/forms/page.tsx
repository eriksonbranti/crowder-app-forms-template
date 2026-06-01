import Link from "next/link"
import { RiCloseLine, RiFileList3Line, RiFilterLine } from "@remixicon/react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { EmptyState } from "@/components/EmptyState"
import { Input } from "@/components/Input"
import { Pagination } from "@/components/dashboard/Pagination"
import {
  countForms,
  listForms,
  type FormListStatus,
} from "@/modules/forms"
import { DateTime } from "@/components/DateTime"
import {
  buildListQuery,
  parsePageParam,
  parseStatusParam,
} from "@/lib/list-query"
import { time, timer } from "@/lib/timing"

import { NewFormDialog } from "./_components/NewFormDialog"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

const ALL_STATUSES: FormListStatus[] = ["published", "draft", "archived"]

const STATUS_LABELS: Record<FormListStatus, string> = {
  published: "Publicados",
  draft: "Borradores",
  archived: "Archivados",
}

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const status = parseStatusParam(sp.status, ALL_STATUSES)
  const pageNum = parsePageParam(sp.page)
  const offset = (pageNum - 1) * PAGE_SIZE

  const total = timer("page Forms total")
  const filters = { search: q, status }
  const [forms, formsTotal] = await Promise.all([
    time("listForms", () =>
      listForms({ ...filters, limit: PAGE_SIZE, offset }),
    ),
    time("countForms", () => countForms(filters)),
  ])
  total()

  const filtersActive = !!(q || status)

  return (
    <main>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Formularios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listado y gestión de formularios expuestos en el iframe del checkout.
          </p>
        </div>
        <NewFormDialog />
      </div>

      <Card className="mb-4 bg-background">
        <form className="flex flex-wrap items-center gap-2" method="get">
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por título o ID…"
            className="w-72"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            <RiFilterLine className="size-4" aria-hidden="true" /> Filtrar
          </Button>
          {filtersActive && (
            <Button asChild variant="ghost">
              <Link href="/forms">
                <RiCloseLine className="size-4" aria-hidden="true" /> Limpiar
              </Link>
            </Button>
          )}
        </form>
      </Card>

      {forms.length === 0 ? (
        filtersActive ? (
          <Card className="bg-background text-center">
            <p className="py-12 text-sm text-muted-foreground">
              Sin formularios que coincidan con los filtros.
            </p>
          </Card>
        ) : (
          <EmptyState
            icon={RiFileList3Line}
            title="Aún no creaste ningún formulario"
          >
            Cuando publiques uno, aparecerá embebido en el checkout de la ticketera.
          </EmptyState>
        )
      ) : (
        <>
          <Card className="overflow-hidden bg-background p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Grupos</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Actualizado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/forms/${f.id}`}
                        className="font-medium text-foreground transition hover:text-primary"
                      >
                        {f.title}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {f.id}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-secondary-foreground tabular-nums">
                      {f.groupCount}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({f.transactionGroupCount} tx · {f.itemGroupCount} item)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!f.enabled ? (
                        <Badge variant="neutral">Archivado</Badge>
                      ) : f.publishedAt ? (
                        <Badge variant="success">Publicado</Badge>
                      ) : (
                        <Badge variant="warning">Borrador</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <DateTime value={f.updatedAt} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button asChild variant="ghost">
                          <Link href={`/forms/${f.id}/submissions`}>
                            Ver respuestas
                          </Link>
                        </Button>
                        <Button asChild variant="secondary">
                          <Link href={`/forms/${f.id}`}>Editar</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4">
            <Pagination
              page={pageNum}
              pageSize={PAGE_SIZE}
              total={formsTotal}
              buildHref={(p) =>
                `/forms${buildListQuery({ q, status, page: pageNum }, { page: p })}`
              }
            />
          </div>
        </>
      )}
    </main>
  )
}
