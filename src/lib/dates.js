/** @param {string | null | undefined} iso */
export function formatIsoToDisplay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const y = d.getFullYear()
  return `${day}/${mo}/${y}`
}

/** dd/mm/yyyy → ISO string for API, or null */
export function parseDisplayToIso(display) {
  const m = String(display ?? '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  const y = Number(m[3])
  const dt = new Date(y, mo - 1, d, 12, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
}

/**
 * For POST/PATCH: accept display dd/mm/yyyy, full ISO string, or null/empty → ISO or undefined.
 * @param {string | null | undefined} displayOrIso
 * @returns {string | undefined}
 */
export function toApiDateTime(displayOrIso) {
  if (displayOrIso == null || String(displayOrIso).trim() === '') return undefined
  const s = String(displayOrIso).trim()
  if (s.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  const iso = parseDisplayToIso(s)
  return iso ?? undefined
}
