import { Card } from "@/components/Card"
import type { FormQuestion } from "@/lib/db/schema"

import type { PersonRow } from "./FormSubmissionRow"

function countValues(persons: PersonRow[], qid: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of persons) {
    const v = p.answers[qid]
    if (v == null) continue
    const values = Array.isArray(v) ? v : [v]
    for (const val of values) {
      const key = String(val)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]))
}

function numericSummary(persons: PersonRow[], qid: string) {
  const nums: number[] = []
  for (const p of persons) {
    const v = p.answers[qid]
    if (typeof v === "number") nums.push(v)
    else if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
      nums.push(Number(v))
    }
  }
  if (nums.length === 0) return null
  nums.sort((a, b) => a - b)
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const median = nums[Math.floor(nums.length / 2)]
  return {
    count: nums.length,
    mean,
    median,
    min: nums[0],
    max: nums[nums.length - 1],
  }
}

export function FormResumenTab({
  questions,
  persons,
}: {
  questions: FormQuestion[]
  persons: PersonRow[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {questions.map((q) => {
        if (
          q.type === "single_choice" ||
          q.type === "dropdown" ||
          q.type === "multiple_choice"
        ) {
          const counts = countValues(persons, q.id)
          const max = Math.max(1, ...counts.values())
          const labelByValue = new Map(
            (q.options ?? []).map((o) => [o.value, o.label]),
          )
          return (
            <Card key={q.id} className="bg-background">
              <h3 className="text-sm font-semibold text-foreground">{q.label}</h3>
              <p className="font-mono text-xs text-muted-foreground">{q.id}</p>
              {counts.size === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sin respuestas.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {[...counts.entries()].map(([k, n]) => (
                    <li key={k}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary-foreground">
                          {labelByValue.get(k) ?? k}
                        </span>
                        <span className="font-mono text-muted-foreground">{n}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded bg-subtle">
                        <div
                          className="h-full rounded bg-primary/80"
                          style={{ width: `${(n / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        }
        if (q.type === "number" || q.type === "scale") {
          const stats = numericSummary(persons, q.id)
          return (
            <Card key={q.id} className="bg-background">
              <h3 className="text-sm font-semibold text-foreground">{q.label}</h3>
              <p className="font-mono text-xs text-muted-foreground">{q.id}</p>
              {!stats ? (
                <p className="mt-3 text-sm text-muted-foreground">Sin respuestas.</p>
              ) : (
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">N</dt>
                  <dd className="font-mono text-foreground">{stats.count}</dd>
                  <dt className="text-muted-foreground">Media</dt>
                  <dd className="font-mono text-foreground">{stats.mean.toFixed(2)}</dd>
                  <dt className="text-muted-foreground">Mediana</dt>
                  <dd className="font-mono text-foreground">{stats.median}</dd>
                  <dt className="text-muted-foreground">Rango</dt>
                  <dd className="font-mono text-foreground">
                    {stats.min} – {stats.max}
                  </dd>
                </dl>
              )}
            </Card>
          )
        }
        if (q.type === "short_text" || q.type === "long_text") {
          const counts = countValues(persons, q.id)
          const top10 = [...counts.entries()].slice(0, 10)
          return (
            <Card key={q.id} className="bg-background">
              <h3 className="text-sm font-semibold text-foreground">{q.label}</h3>
              <p className="font-mono text-xs text-muted-foreground">{q.id}</p>
              {top10.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sin respuestas.</p>
              ) : (
                <ul className="mt-4 space-y-1 text-sm">
                  {top10.map(([k, n]) => (
                    <li
                      key={k}
                      className="flex justify-between border-b border-border py-1 last:border-0"
                    >
                      <span className="truncate text-secondary-foreground">{k}</span>
                      <span className="font-mono text-muted-foreground">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        }
        return null
      })}
    </div>
  )
}
