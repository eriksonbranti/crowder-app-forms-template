// Matches globals.css --primary (blue-500).
export const DEFAULT_BRAND_HEX = "#3b82f6"

const HEX_RE = /^#?([0-9a-f]{6})$/i

function parseHex(value: string): [number, number, number] | null {
  const m = HEX_RE.exec(value.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function isValidHex(value: string): boolean {
  return parseHex(value) !== null
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0)
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
    }
    h *= 60
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export type BrandTokens = {
  primary: string // "H S% L%"
  primaryHover: string
  ring: string
  primaryForeground: string
}

function tokensFromRgb(r: number, g: number, b: number): BrandTokens {
  const [h, s, l] = rgbToHsl(r, g, b)
  const hoverL = l > 30 ? Math.max(0, l - 7) : Math.min(100, l + 8)
  const fg = luminance(r, g, b) > 0.5 ? "222 47% 11%" : "0 0% 100%"
  return {
    primary: `${h} ${s}% ${l}%`,
    primaryHover: `${h} ${s}% ${hoverL}%`,
    ring: `${h} ${s}% ${l}%`,
    primaryForeground: fg,
  }
}

// Scoped to [data-embed-root] so dashboard chrome keeps the Crowder palette.
export function embedThemeStyle(
  theme: { primary?: string } | null,
): string | null {
  const rgb = theme?.primary ? parseHex(theme.primary) : null
  if (!rgb) return null
  const t = tokensFromRgb(...rgb)
  return `[data-embed-root]{--primary:${t.primary};--primary-hover:${t.primaryHover};--ring:${t.ring};--primary-foreground:${t.primaryForeground};}`
}
