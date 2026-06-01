"use client"

import { useState } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { DateTime } from "@/components/DateTime"
import { formatAnswer } from "@/lib/formatters"
import type { FormQuestion } from "@/lib/db/schema"
import type { PersonRow } from "@/modules/submissions"

import { EditSubmissionDrawer } from "./EditSubmissionDrawer"

export type { PersonRow }

const ORIGIN_BADGE = {
  auto: { variant: "neutral", label: "auto" },
  edited: { variant: "warning", label: "editado" },
} as const

// Treat values that only differ in surrounding whitespace or letter case as
// equal: emails and country codes are case-insensitive, and trailing/leading
// whitespace is not user intent. Falls short for normalized formats (e.g. a
// document re-typed with dots removed) — for those cells we'd need an origin
// flag persisted at submit time, not a string compare here.
function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase()
}

export function FormSubmissionRow({
  row,
  questions,
  statusBadge,
}: {
  row: PersonRow
  questions: FormQuestion[]
  statusBadge: React.ReactNode
}) {
  const [editing, setEditing] = useState<{
    submissionId: string
    initial: Record<string, unknown>
  } | null>(null)

  // The drawer edits one submission at a time. Pick the first answered
  // question's submission as the default entry point.
  const defaultSubmissionId = row.submissionByQuestion.values().next().value as
    | string
    | undefined

  return (
    <>
      <tr className="border-b border-border transition last:border-0 hover:bg-muted/40">
        <td className="px-4 py-3 text-foreground">
          {row.hasItem ? (
            <>
              <div className="font-medium">{row.holderName ?? "—"}</div>
              {row.holderDocument && (
                <p className="font-mono text-xs text-muted-foreground">
                  {row.holderDocument}
                </p>
              )}
              {row.sectorRate && (
                <p className="text-xs text-muted-foreground">{row.sectorRate}</p>
              )}
            </>
          ) : (
            <>
              <div className="font-medium">{row.buyerName ?? "—"}</div>
              {row.buyerEmail && (
                <p className="text-xs text-muted-foreground">{row.buyerEmail}</p>
              )}
              <p className="font-mono text-[11px] text-muted-foreground">
                {row.transactionId.slice(0, 14)}…
              </p>
            </>
          )}
        </td>
        <td className="px-4 py-3 text-secondary-foreground">
          <div className="truncate" title={row.eventName}>
            {row.eventName}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {row.eventId}
          </p>
        </td>
        {questions.map((q) => {
          const rawAnswer = row.answers[q.id]
          const text = formatAnswer(rawAnswer)
          const ctxValue = q.prefillFrom ? row.context[q.prefillFrom] : undefined
          // "auto" = the user kept the Crowder-provided value; "editado" = they
          // changed it. Only meaningful when the question has a prefill path,
          // the snapshot carried that path, and the user actually answered.
          const hasAnswer = rawAnswer != null && rawAnswer !== ""
          const origin: keyof typeof ORIGIN_BADGE | null =
            q.prefillFrom && ctxValue && hasAnswer
              ? normalizeForCompare(String(rawAnswer)) ===
                normalizeForCompare(ctxValue)
                ? "auto"
                : "edited"
              : null
          const badge = origin ? ORIGIN_BADGE[origin] : null
          return (
            <td
              key={q.id}
              className="max-w-[200px] px-4 py-3 text-secondary-foreground"
              title={text}
            >
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 truncate">{text}</span>
                {badge && (
                  <Badge
                    variant={badge.variant}
                    className="shrink-0 px-1 py-0 text-[10px]"
                    title={origin === "edited" ? `Original: ${ctxValue}` : undefined}
                  >
                    {badge.label}
                  </Badge>
                )}
              </div>
            </td>
          )
        })}
        <td className="px-4 py-3">
          {statusBadge}
          {row.edited && (
            <Badge variant="neutral" className="ml-2">
              editada
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          <DateTime value={row.lastActivity} />
        </td>
        <td className="px-4 py-3 text-right">
          {defaultSubmissionId && (
            <Button
              variant="secondary"
              onClick={() =>
                setEditing({
                  submissionId: defaultSubmissionId,
                  initial: row.answers,
                })
              }
            >
              Editar
            </Button>
          )}
        </td>
      </tr>

      {editing && (
        <EditSubmissionDrawer
          submissionId={editing.submissionId}
          initialAnswers={editing.initial}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
