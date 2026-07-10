/**
 * csv — geração e download de CSV no cliente (sem dependência externa).
 *
 * Convenção amigável ao Excel pt-BR: delimitador ";" + BOM UTF-8.
 * Números são exportados crus (decimal com ponto) para análise; rótulos em pt-BR.
 */

const BOM = '﻿'

function escapeCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(';'))
  return BOM + lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    /* download indisponível — ignora silenciosamente */
  }
}
