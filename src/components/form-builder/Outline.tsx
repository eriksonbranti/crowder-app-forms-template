"use client"

import {
  RiAddLine,
  RiArchiveLine,
  RiArrowRightSLine,
  RiFileTextLine,
  RiStackLine,
} from "@remixicon/react"
import { useState } from "react"

import type { FormDefinition } from "@/lib/db/schema"
import { cx } from "@/lib/utils"

import { QUESTION_TYPE_BY_VALUE } from "./question-types"
import type { BuilderSelection } from "./types"

export function Outline({
  definition,
  selection,
  onSelect,
  onAddGroup,
  onAddQuestion,
  children,
}: {
  definition: FormDefinition
  selection: BuilderSelection
  onSelect: (s: BuilderSelection) => void
  onAddGroup: () => void
  onAddQuestion: (gIdx: number) => void
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(definition.groups.map((_, i) => i)),
  )

  function toggleExpand(idx: number, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const isFormSel = selection.kind === "form"
  const totalQuestions = definition.groups.reduce(
    (sum, g) => sum + g.questions.length,
    0,
  )

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="border-b border-border px-3 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Esquema del form
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        <button
          type="button"
          onClick={() => onSelect({ kind: "form" })}
          className={cx(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition",
            isFormSel
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-subtle",
          )}
        >
          <RiFileTextLine className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate font-medium">Configuración del form</span>
        </button>

        <div className="mx-1 my-2 h-px bg-border/60" />

        {definition.groups.map((group, gIdx) => {
          const isExpanded = expanded.has(gIdx)
          const isGroupSel =
            selection.kind === "group" && selection.gIdx === gIdx
          return (
            <div key={group.id + ":" + gIdx}>
              <div
                onClick={() => onSelect({ kind: "group", gIdx })}
                className={cx(
                  "flex cursor-pointer items-center gap-1 rounded-md py-1.5 pl-1 pr-1 text-sm transition",
                  isGroupSel
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-subtle",
                )}
              >
                <button
                  type="button"
                  onClick={(e) => toggleExpand(gIdx, e)}
                  aria-label={isExpanded ? "Colapsar" : "Expandir"}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground"
                >
                  <RiArrowRightSLine
                    className={cx(
                      "size-4 transition-transform",
                      isExpanded && "rotate-90",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {group.scope === "item" ? (
                  <RiStackLine
                    className={cx(
                      "size-4 shrink-0",
                      isGroupSel ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                ) : (
                  <RiArchiveLine
                    className={cx(
                      "size-4 shrink-0",
                      isGroupSel ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {group.title || "(sin título)"}
                </span>
                <span className="mr-1 shrink-0 text-[10px] uppercase tracking-wide text-faint">
                  {group.scope === "item" ? "item" : "tx"}
                </span>
              </div>

              {isExpanded && (
                <div className="ml-7 mt-0.5 space-y-0.5 border-l border-border pl-1.5">
                  {group.questions.map((q, qIdx) => {
                    const isQSel =
                      selection.kind === "question" &&
                      selection.gIdx === gIdx &&
                      selection.qIdx === qIdx
                    const typeMeta =
                      QUESTION_TYPE_BY_VALUE[q.type] ??
                      QUESTION_TYPE_BY_VALUE.short_text
                    const Icon = typeMeta.Icon
                    return (
                      <button
                        key={q.id + ":" + qIdx}
                        type="button"
                        onClick={() =>
                          onSelect({ kind: "question", gIdx, qIdx })
                        }
                        className={cx(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
                          isQSel
                            ? "bg-primary/10 text-primary"
                            : "text-secondary-foreground hover:bg-subtle",
                        )}
                      >
                        <Icon
                          className={cx(
                            "size-3.5 shrink-0",
                            isQSel ? "text-primary" : "text-faint",
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {q.label || "(sin label)"}
                        </span>
                        {q.required && (
                          <span className="text-xs text-destructive">*</span>
                        )}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddQuestion(gIdx)
                    }}
                    className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground transition hover:bg-subtle hover:text-foreground"
                  >
                    <RiAddLine className="size-3.5" aria-hidden="true" />
                    Agregar pregunta
                  </button>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={onAddGroup}
          className="mt-2 flex w-full items-center gap-2 whitespace-nowrap rounded-md border border-dashed border-border px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-subtle hover:text-foreground"
        >
          <RiAddLine className="size-4" aria-hidden="true" />
          Agregar grupo
        </button>
      </div>

      {children}

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          {definition.groups.length}{" "}
          {definition.groups.length === 1 ? "grupo" : "grupos"} · {totalQuestions}{" "}
          {totalQuestions === 1 ? "pregunta" : "preguntas"}
        </span>
      </div>
    </aside>
  )
}
