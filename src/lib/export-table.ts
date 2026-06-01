import writeXlsxFile from "write-excel-file/node"
import type { SheetData } from "write-excel-file/node"

function csvEscape(value: unknown): string {
  if (value == null) return ""
  let s = Array.isArray(value) ? value.join("; ") : String(value)
  // CSV injection: cells starting with =, +, -, @, |, tab or CR are
  // interpreted as formulas by Excel/Sheets. Prefix with a single quote.
  if (/^[=+\-@|\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// A logical, format-agnostic table. Domain code builds this once and the
// serializers below turn it into CSV or a real `.xlsx`, so both export levels
// (group drilldown and "export all") share one column structure.
export type ExportCellType = "text" | "number"
export type ExportColumn = { header: string; type?: ExportCellType }
export type ExportCell = string | number | null | undefined
export type ExportTable = {
  columns: ExportColumn[]
  rows: ExportCell[][]
}

export type ExportFormat = "csv" | "xlsx"

export function parseExportFormat(value: string | null): ExportFormat {
  return value === "xlsx" || value === "excel" ? "xlsx" : "csv"
}

export function tableToCsv(table: ExportTable): string {
  const lines = [table.columns.map((c) => csvEscape(c.header)).join(",")]
  for (const row of table.rows) {
    lines.push(row.map(csvEscape).join(","))
  }
  return lines.join("\n")
}

export async function tableToXlsx(table: ExportTable): Promise<Buffer> {
  const header = table.columns.map((c) => ({
    value: c.header,
    fontWeight: "bold" as const,
  }))
  const body = table.rows.map((row) =>
    row.map((cell, i) => {
      if (cell == null || cell === "") return null
      if (table.columns[i]?.type === "number") {
        const n = typeof cell === "number" ? cell : Number(cell)
        if (Number.isFinite(n)) return { type: Number, value: n }
      }
      // String cells are written as inline strings, never formulas, so the
      // CSV-injection quoting that `csvEscape` applies is not needed here.
      return { type: String, value: String(cell) }
    }),
  )
  const data = [header, ...body] as unknown as SheetData
  return writeXlsxFile(data).toBuffer()
}

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// Serialize a table to a downloadable HTTP response. `basename` has no extension.
export async function exportTableResponse(
  table: ExportTable,
  format: ExportFormat,
  basename: string,
): Promise<Response> {
  if (format === "xlsx") {
    const buffer = await tableToXlsx(table)
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${basename}.xlsx"`,
      },
    })
  }
  // Prepend a UTF-8 BOM so Excel opens accented CSV without mojibake.
  const csv = "\uFEFF" + tableToCsv(table)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${basename}.csv"`,
    },
  })
}
