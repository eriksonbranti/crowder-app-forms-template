import { RiEditLine } from "@remixicon/react"

import { Card } from "@/components/Card"
import { DateTime } from "@/components/DateTime"
import { EmptyCard } from "@/components/dashboard/EmptyCard"
import { formatAnswer } from "@/lib/formatters"
import type { FormEditRow } from "@/modules/submissions"

function diffKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const k of keys) {
    const a = JSON.stringify(before[k] ?? null)
    const b = JSON.stringify(after[k] ?? null)
    if (a !== b) changed.push(k)
  }
  return changed
}

export function FormHistoricoTab({
  edits,
  total,
  groupsById,
}: {
  edits: FormEditRow[]
  total: number
  groupsById: Record<string, string>
}) {
  if (edits.length === 0) {
    return <EmptyCard message="Sin ediciones registradas." />
  }
  return (
    <div className="space-y-3">
      {total > edits.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando las {edits.length} ediciones más recientes de {total}.
        </p>
      )}
      {edits.map((edit) => {
        const changed = diffKeys(edit.answersBefore, edit.answersAfter)
        const groupLabel = groupsById[edit.groupId] ?? edit.groupId
        return (
          <Card key={edit.id} className="bg-background">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <RiEditLine className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {edit.submissionLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">en</span>
                  <span className="text-xs text-foreground">{groupLabel}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">por</span>
                  <span className="font-mono text-xs text-foreground">
                    {edit.editedBy}
                  </span>
                </div>
                {edit.reason && (
                  <p className="mt-2 text-sm text-secondary-foreground">
                    {edit.reason}
                  </p>
                )}
              </div>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                <DateTime value={edit.editedAt} />
              </p>
            </div>
            {changed.length > 0 && (
              <div className="mt-3 divide-y divide-border rounded-md border border-border">
                {changed.map((key) => (
                  <div
                    key={key}
                    className="grid grid-cols-[1fr_1fr_1fr] gap-4 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">{key}</span>
                    <span className="text-secondary-foreground">
                      <span className="text-faint">de</span>{" "}
                      {formatAnswer(edit.answersBefore[key])}
                    </span>
                    <span className="text-foreground">
                      <span className="text-faint">a</span>{" "}
                      {formatAnswer(edit.answersAfter[key])}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
