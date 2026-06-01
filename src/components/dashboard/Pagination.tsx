import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react"
import Link from "next/link"

import { cx } from "@/lib/utils"
import { formatInt } from "@/lib/formatters"

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  buildHref: (page: number) => string
}

const baseBtn =
  "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/60"
const disabledBtn = "pointer-events-none opacity-40"

export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const hasPrev = page > 1
  const hasNext = to < total

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground tabular-nums">
      <span>
        {total === 0 ? (
          "Sin resultados"
        ) : (
          <>
            <span className="font-medium text-foreground">
              {formatInt(from)}–{formatInt(to)}
            </span>
            {" de "}
            <span className="font-medium text-foreground">
              {formatInt(total)}
            </span>
          </>
        )}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={hasPrev ? buildHref(page - 1) : "#"}
          aria-disabled={!hasPrev}
          aria-label="Página anterior"
          className={cx(baseBtn, !hasPrev && disabledBtn)}
        >
          <RiArrowLeftSLine className="size-4" aria-hidden="true" />
          Anterior
        </Link>
        <span>Página {formatInt(page)}</span>
        <Link
          href={hasNext ? buildHref(page + 1) : "#"}
          aria-disabled={!hasNext}
          aria-label="Página siguiente"
          className={cx(baseBtn, !hasNext && disabledBtn)}
        >
          Siguiente
          <RiArrowRightSLine className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
