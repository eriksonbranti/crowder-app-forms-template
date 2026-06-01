import type { TransactionStatus } from "@/lib/db/schema"

const COLORS: Record<TransactionStatus, { stroke: string; fill: string }> = {
  valid: { stroke: "hsl(217 91% 60%)", fill: "hsl(217 91% 60% / 0.15)" },
  reserved: { stroke: "hsl(41 96% 50%)", fill: "hsl(41 96% 50% / 0.15)" },
  confirmed: { stroke: "hsl(158 64% 40%)", fill: "hsl(158 64% 40% / 0.15)" },
  expired: { stroke: "hsl(218 11% 50%)", fill: "hsl(218 11% 50% / 0.15)" },
  refunded: { stroke: "hsl(218 11% 50%)", fill: "hsl(218 11% 50% / 0.15)" },
}

export function Sparkline({
  data,
  status,
  width = 96,
  height = 28,
}: {
  data: number[]
  status: TransactionStatus
  width?: number
  height?: number
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1 || 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path = "M " + points.join(" L ")
  const areaPath = `${path} L ${width},${height} L 0,${height} Z`
  const c = COLORS[status]
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      <path d={areaPath} fill={c.fill} />
      <path
        d={path}
        fill="none"
        stroke={c.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
