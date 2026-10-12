// Utilidades de formato: importes, fechas y textos.
// Son funciones puras (sin React ni navegador) para poder probarlas con `npm test`.

/**
 * Convierte un importe escrito por el usuario en céntimos (número entero).
 * Trabajar en céntimos evita errores de redondeo típicos de los decimales (0,1 + 0,2).
 *
 * Acepta formato español ("1.250,50", "1250,5", "1250") y también "1250.50".
 * Devuelve:
 *   - null  si el campo está vacío
 *   - NaN   si el texto no es un importe válido
 *   - un entero (céntimos) si es válido
 */
export function parseAmountToCents(raw) {
  if (raw === null || raw === undefined) return null
  let s = String(raw).trim().replace(/[\s  €]/g, '')
  if (s === '') return null
  if (!/^-?[\d.,]+$/.test(s)) return NaN

  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma > -1 && lastDot > -1) {
    // Hay los dos separadores: el último que aparece es el decimal.
    if (lastComma > lastDot) {
      if (!isThousandsGrouped(s.slice(0, lastComma), '.')) return NaN
      s = s.slice(0, lastComma).replace(/\./g, '') + '.' + s.slice(lastComma + 1)
    } else {
      if (!isThousandsGrouped(s.slice(0, lastDot), ',')) return NaN
      s = s.slice(0, lastDot).replace(/,/g, '') + '.' + s.slice(lastDot + 1)
    }
    if (s.split('.')[1].length > 2) return NaN
  } else if (lastComma > -1) {
    // Solo comas: en España la coma es el separador decimal.
    const parts = s.split(',')
    if (parts.length !== 2 || parts[1].length === 0 || parts[1].length > 2) return NaN
    s = parts.join('.')
  } else if (lastDot > -1) {
    // Solo puntos: "1.250" o "1.250.000" son miles; "1250.5" es decimal.
    const parts = s.split('.')
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      // decimal, se deja igual
    } else if (parts.slice(1).every((p) => p.length === 3) && parts[0].length > 0) {
      s = parts.join('')
    } else {
      return NaN
    }
  }

  if (s === '' || s === '.') return NaN
  const n = Number(s)
  if (!Number.isFinite(n)) return NaN
  const cents = Math.round(n * 100)
  return negative ? -cents : cents
}

function isThousandsGrouped(intPart, sep) {
  if (!intPart.includes(sep)) return /^\d+$/.test(intPart)
  const groups = intPart.split(sep)
  return /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g))
}

/**
 * Formatea céntimos como euros en formato español: 125050 -> "1.250,50 €".
 * Se hace a mano (sin Intl) para que el resultado sea idéntico en todos los
 * navegadores y use solo espacios normales, que el PDF puede representar.
 */
export function formatCents(cents) {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const euros = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}${grouped},${rest} €`
}

/** Convierte un porcentaje escrito por el usuario ("21", "21,5") en número o NaN/null. */
export function parsePercent(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim().replace('%', '').replace(',', '.').trim()
  if (s === '') return null
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

/** Formatea un porcentaje en estilo español: 21 -> "21 %", 10.5 -> "10,5 %". */
export function formatPercent(n) {
  return `${String(Math.round(n * 100) / 100).replace('.', ',')} %`
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-10-12" -> Date local (sin desfases por zona horaria). Devuelve null si no es válida. */
export function parseISODate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

/** Date -> "12 de octubre de 2026" */
export function formatLongDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`
}

/** Fecha de hoy en formato "AAAA-MM-DD" (hora local). */
export function todayISO(now = new Date()) {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function addDays(date, days) {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

/** Quita espacios sobrantes al principio y final, y normaliza saltos de línea. */
export function cleanText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n?/g, '\n').trim()
}

/** Texto apto para nombre de archivo: "Panadería La Espiga" -> "panaderia-la-espiga" */
export function slugify(value, maxLength = 40) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}
