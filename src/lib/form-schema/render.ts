import type { FormGroup, ItemSnapshot } from "@/lib/db/schema"
import type { UserSnapshot } from "@/modules/submissions/types"

type TemplateContext = {
  answers: Record<string, unknown>
  item?: ItemSnapshot | null
  user?: UserSnapshot | null
}

/**
 * Resolves a mustache-style `{{path}}` token against the given context.
 * Supports: `item.holder.firstName`, `item.sectorName`, `user.email`, or a bare
 * `questionId` (resolved from `answers`).
 */
export function renderLabel(group: FormGroup, ctx: TemplateContext): string {
  return group.labelTemplate.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const value = resolvePath(path, ctx)
    return value == null ? "" : String(value)
  })
}

function resolvePath(path: string, ctx: TemplateContext): unknown {
  if (path.startsWith("item.")) {
    return getPath(ctx.item, path.slice("item.".length))
  }
  if (path.startsWith("user.")) {
    return getPath(ctx.user, path.slice("user.".length))
  }
  return ctx.answers[path]
}

function getPath(root: unknown, path: string): unknown {
  if (root == null) return undefined
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc == null || typeof acc !== "object") return undefined
    return (acc as Record<string, unknown>)[segment]
  }, root)
}

/**
 * Markdown-lite sanitizer: keeps inline links `[text](https://…)`, **bold**,
 * *italic*. Escapes all other HTML. Returns a string of safe HTML.
 *
 * Defensive — never trust the form definition to be HTML-clean: even if the
 * builder validates input, the JSON could be tampered with in DB.
 */
export function renderMarkdownLite(input: string): string {
  // Scan links on the RAW (unescaped) input so the URL is validated and
  // escaped exactly once against its true value.
  const linkRe = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g
  let out = ""
  let lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = linkRe.exec(input)) !== null) {
    const [full, text, url] = m
    out += renderInline(input.slice(lastIndex, m.index))
    out += isSafeHttpsUrl(url)
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${renderInline(text)}</a>`
      : renderInline(full)
    lastIndex = linkRe.lastIndex
  }
  out += renderInline(input.slice(lastIndex))

  return out
}

// Re-parses the URL the link regex already matched: catches malformed
// authorities that the regex's literal `https://` prefix would let through.
function isSafeHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

/** Escapes HTML, then layers in **bold** / *italic* on the safe text. */
function renderInline(segment: string): string {
  const escaped = escapeHtml(segment)

  const withBold = escaped.replace(
    /\*\*([^*]+)\*\*/g,
    (_, text: string) => `<strong>${text}</strong>`,
  )

  return withBold.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    (_, text: string) => `<em>${text}</em>`,
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
