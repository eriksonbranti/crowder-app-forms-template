import {
  RiArrowLeftLine,
  RiBarChart2Line,
  RiCloseLine,
  RiFilterLine,
  RiHistoryLine,
  RiTable2,
} from "@remixicon/react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { TabNav } from "@/components/dashboard/TabNav"
import { Pagination } from "@/components/dashboard/Pagination"
import { Badge } from "@/components/Badge"
import { EmptyCard } from "@/components/dashboard/EmptyCard"
import { findForm, findLatest } from "@/modules/forms"
import {
  drilldownByForm,
  eventsForForm,
  listEditsByForm,
  mergeByPerson,
} from "@/modules/submissions"
import type {
  FormQuestion,
  TransactionStatus,
} from "@/lib/db/schema"
import { formatInt } from "@/lib/formatters"
import { parsePageParam } from "@/lib/list-query"

import { FormHistoricoTab } from "./_components/FormHistoricoTab"
import { FormSubmissionRow } from "./_components/FormSubmissionRow"
import { FormResumenTab } from "./_components/FormResumenTab"
import { ExportFormMenu } from "./_components/ExportFormMenu"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export default async function FormDrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    tab?: string
    page?: string
    q?: string
    eventId?: string
  }>
}) {
  const { id: formId } = await params
  const {
    tab = "tabla",
    page: pageParam,
    q: qParam,
    eventId: eventIdParam,
  } = await searchParams
  const search = qParam?.trim() || undefined
  const pageNum = parsePageParam(pageParam)
  const isTablaTab = tab === "tabla"
  const parsedEventId = eventIdParam ? Number(eventIdParam) : undefined
  const eventId = Number.isFinite(parsedEventId) ? parsedEventId : undefined

  const published = await findLatest(formId)
  if (!published) {
    // No formVersion exists yet — the form has never been published, so there
    // can't be any submissions. Show a friendly empty state instead of 404.
    const form = await findForm(formId)
    if (!form) notFound()
    return (
      <main className="space-y-6">
        <div>
          <Link
            href="/forms"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <RiArrowLeftLine className="size-3.5" aria-hidden="true" /> Formularios
          </Link>
          <div className="mt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">Reporte por formulario</span>
              <span className="text-faint">·</span>
              <span className="truncate font-mono">{form.id}</span>
              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                Sin publicar
              </Badge>
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
              {form.title}
            </h1>
          </div>
        </div>
        <EmptyCard message="Este formulario todavía no se publicó, por lo que aún no puede recibir respuestas. Publicalo desde el editor para empezar a recolectar datos." />
        <div>
          <Button asChild variant="secondary">
            <Link href={`/forms/${form.id}`}>Ir al editor</Link>
          </Button>
        </div>
      </main>
    )
  }

  const filters = {
    eventId,
    formId,
    statuses: ["confirmed"] as TransactionStatus[],
    search,
  }

  const [rawRows, editsResult, eventOptions] = await Promise.all([
    tab === "historico" ? Promise.resolve([]) : drilldownByForm(filters),
    tab === "historico"
      ? listEditsByForm({ eventId, formId, limit: 100 })
      : Promise.resolve({ rows: [], total: 0 }),
    isTablaTab ? eventsForForm(formId) : Promise.resolve([]),
  ])
  const { rows: edits, total: totalEdits } = editsResult

  const persons = mergeByPerson(rawRows)

  // Union of questions across all groups of the form. Skip info blocks and
  // dedup by question id (publishers don't enforce uniqueness across groups
  // but the runtime treats it as one keyspace).
  const seenQ = new Set<string>()
  const allQuestions: FormQuestion[] = []
  const groupsById = new Map(
    published.version.definition.groups.map((g) => [g.id, g]),
  )
  for (const g of published.version.definition.groups) {
    for (const q of g.questions) {
      if (q.type === "info") continue
      if (seenQ.has(q.id)) continue
      seenQ.add(q.id)
      allQuestions.push(q)
    }
  }

  const baseHref = `/forms/${formId}/submissions`
  const buildHref = (overrides: {
    tab?: string
    page?: number
    q?: string
    eventId?: number | null
  }) => {
    const sp = new URLSearchParams()
    sp.set("tab", overrides.tab ?? tab)
    const q = overrides.q ?? search
    if (q) sp.set("q", q)
    if (overrides.page && overrides.page > 1)
      sp.set("page", String(overrides.page))
    const ev =
      overrides.eventId === undefined ? eventId : overrides.eventId ?? undefined
    if (ev !== undefined) sp.set("eventId", String(ev))
    return `${baseHref}?${sp.toString()}`
  }
  const tabHref = (t: string) => buildHref({ tab: t })

  const pagedPersons = isTablaTab
    ? persons.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE)
    : persons

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/forms"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3.5" aria-hidden="true" /> Formularios
        </Link>
        <div className="mt-1 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">Reporte por formulario</span>
              <span className="text-faint">·</span>
              <span className="truncate font-mono">{published.form.id}</span>
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
              {published.form.title}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Una fila por persona, columnas de todos los grupos del form.
            </p>
          </div>
          {isTablaTab && (
            <ExportFormMenu
              formId={formId}
              eventId={eventId}
              search={search}
            />
          )}
        </div>
      </div>

      <TabNav
        active={tab}
        tabs={[
          {
            key: "tabla",
            label: "Tabla",
            href: tabHref("tabla"),
            icon: RiTable2,
          },
          {
            key: "resumen",
            label: "Resumen",
            href: tabHref("resumen"),
            icon: RiBarChart2Line,
          },
          {
            key: "historico",
            label: "Histórico",
            href: tabHref("historico"),
            icon: RiHistoryLine,
          },
        ]}
      />

      {tab === "tabla" && (
        <>
          <Card className="bg-background">
            <form className="flex flex-wrap items-center gap-2" method="get">
              <input type="hidden" name="tab" value="tabla" />
              <Input
                type="search"
                name="q"
                defaultValue={search ?? ""}
                placeholder="Buscar por nombre, email o documento…"
                className="w-72"
              />
              {eventOptions.length > 0 && (
                <select
                  name="eventId"
                  defaultValue={eventId !== undefined ? String(eventId) : ""}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">
                    Todos los eventos (
                    {formatInt(
                      eventOptions.reduce((s, e) => s + e.total, 0),
                    )}
                    )
                  </option>
                  {eventOptions.map((e) => (
                    <option key={e.eventId} value={e.eventId}>
                      {e.eventName} ({formatInt(e.total)})
                    </option>
                  ))}
                </select>
              )}
              <Button type="submit" variant="secondary">
                <RiFilterLine className="size-4" aria-hidden="true" /> Filtrar
              </Button>
              {(search || eventId !== undefined) && (
                <Button asChild variant="ghost">
                  <Link href={buildHref({ q: "", eventId: null })}>
                    <RiCloseLine className="size-4" aria-hidden="true" /> Limpiar
                  </Link>
                </Button>
              )}
            </form>
          </Card>
          {pagedPersons.length === 0 ? (
            <Card className="bg-background text-center">
              <p className="py-12 text-sm text-muted-foreground">
                {search
                  ? "Sin respuestas que coincidan con la búsqueda."
                  : "Sin respuestas para los filtros activos."}
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden bg-background p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Persona</th>
                      <th className="px-4 py-3 font-medium">Evento</th>
                      {allQuestions.map((q) => (
                        <th key={q.id} className="px-4 py-3 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {q.label}
                            {q.prefillFrom && (
                              <Badge
                                variant="neutral"
                                className="px-1 py-0 text-[10px] normal-case"
                                title={`Pre-cargado desde ${q.prefillFrom}`}
                              >
                                auto
                              </Badge>
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPersons.map((p) => (
                      <FormSubmissionRow
                        key={p.key}
                        row={p}
                        questions={allQuestions}
                        statusBadge={<StatusBadge status={p.transactionStatus} />}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {persons.length > PAGE_SIZE && (
            <Pagination
              page={pageNum}
              pageSize={PAGE_SIZE}
              total={persons.length}
              buildHref={(p) => buildHref({ tab: "tabla", page: p })}
            />
          )}
        </>
      )}

      {tab === "resumen" && (
        <FormResumenTab questions={allQuestions} persons={persons} />
      )}

      {tab === "historico" && (
        <FormHistoricoTab
          edits={edits}
          total={totalEdits}
          groupsById={Object.fromEntries(
            [...groupsById.entries()].map(([id, g]) => [id, g.title]),
          )}
        />
      )}
    </main>
  )
}
