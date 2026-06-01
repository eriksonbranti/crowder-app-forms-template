import { cx } from "@/lib/utils"

type Status = "confirmed" | "reserved" | "expired"

export type StackedAreaDatum = {
  date: string
  confirmed: number
  reserved: number
  expired: number
}

const FILL: Record<Status, string> = {
  confirmed: "hsl(158 64% 40% / 0.85)",
  reserved: "hsl(41 96% 50% / 0.8)",
  expired: "hsl(218 11% 50% / 0.5)",
}
const STROKE: Record<Status, string> = {
  confirmed: "hsl(158 64% 40%)",
  reserved: "hsl(41 96% 50%)",
  expired: "hsl(218 11% 50%)",
}

const STATUSES: Status[] = ["confirmed", "reserved", "expired"]

export function StackedAreaChart({
  data,
  height = 200,
}: {
  data: StackedAreaDatum[]
  height?: number
}) {
  const W = 1000
  const H = height
  const pad = { top: 12, right: 12, bottom: 24, left: 36 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const n = data.length

  if (n === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
        Sin datos en la ventana.
      </div>
    )
  }

  const yMax = Math.max(
    1,
    ...data.map((d) => STATUSES.reduce((s, k) => s + (d[k] || 0), 0)),
  )
  const yScale = (v: number) => innerH - (v / yMax) * innerH
  const xScale = (i: number) => (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)

  const accum = new Array(n).fill(0) as number[]
  const bands = STATUSES.map((status) => {
    const top = data.map((d, i) => {
      const next = accum[i] + (d[status] || 0)
      const pt = { x: xScale(i), y: yScale(next) }
      accum[i] = next
      return pt
    })
    return { status, top }
  })

  const polys: { status: Status; points: { x: number; y: number }[] }[] = []
  let prevBottom = data.map((_, i) => ({ x: xScale(i), y: yScale(0) }))
  for (const band of bands) {
    const points = [...band.top, ...prevBottom.slice().reverse()]
    polys.push({ status: band.status, points })
    prevBottom = band.top
  }

  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((yMax * i) / tickCount),
  )

  const xLabelEvery = Math.max(1, Math.floor(n / 6))
  const xLabels = data.map((d, i) =>
    i % xLabelEvery === 0 || i === n - 1 ? d.date.slice(5) : null,
  )

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Transacciones por día por estado"
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              y1={pad.top + yScale(t)}
              x2={W - pad.right}
              y2={pad.top + yScale(t)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "0" : "3 3"}
            />
            <text
              x={pad.left - 6}
              y={pad.top + yScale(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
            >
              {t}
            </text>
          </g>
        ))}
        <g transform={`translate(${pad.left}, ${pad.top})`}>
          {polys.map((p) => (
            <polygon
              key={p.status}
              points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              fill={FILL[p.status]}
              stroke={STROKE[p.status]}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          ))}
        </g>
        <g>
          {xLabels.map((label, i) =>
            label ? (
              <text
                key={i}
                x={pad.left + xScale(i)}
                y={H - 6}
                textAnchor="middle"
                fontSize="11"
                fill="hsl(var(--muted-foreground))"
              >
                {label}
              </text>
            ) : null,
          )}
        </g>
      </svg>
    </div>
  )
}

export function ChartLegend() {
  const items: { key: Status; label: string }[] = [
    { key: "confirmed", label: "Confirmadas" },
    { key: "reserved", label: "Reservadas" },
    { key: "expired", label: "Expiradas" },
  ]
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground",
      )}
    >
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: FILL[it.key] }}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}
