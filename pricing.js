// Cálculo de importes. Todo en céntimos (enteros) para evitar errores de redondeo.
// No se inventa ningún impuesto ni descuento: solo se aplican si el usuario los indica.

import { parseAmountToCents, parsePercent } from './format.js'

/** Líneas de precio con algo escrito (ignora filas totalmente vacías). */
export function filledPriceItems(items = []) {
  return items.filter((i) => (i.concept ?? '').trim() !== '' || (i.unitPrice ?? '').trim() !== '')
}

/**
 * Cantidad en centésimas: "2" → 200, "2,5" → 250. Vacía cuenta como 1.
 * Devuelve NaN si no es válida o no es mayor que 0.
 */
export function parseQuantity(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return 100
  const hundredths = parseAmountToCents(s)
  if (hundredths === null || Number.isNaN(hundredths) || hundredths <= 0) return NaN
  return hundredths
}

/** Importe del descuento en céntimos. Devuelve { cents, valid, percent } */
export function computeDiscount(discount, subtotal) {
  const mode = discount?.mode ?? 'none'
  if (mode === 'percent') {
    const percent = parsePercent(discount.value)
    if (typeof percent !== 'number' || Number.isNaN(percent) || percent <= 0 || percent > 100) {
      return { cents: 0, valid: false, percent: null, mode }
    }
    return { cents: Math.round((subtotal * percent) / 100), valid: true, percent, mode }
  }
  if (mode === 'amount') {
    const cents = parseAmountToCents(discount.value)
    if (cents === null || Number.isNaN(cents) || cents <= 0 || cents > subtotal) {
      return { cents: 0, valid: false, percent: null, mode }
    }
    return { cents, valid: true, percent: null, mode }
  }
  return { cents: 0, valid: true, percent: null, mode: 'none' }
}

/**
 * Desglose de la propuesta:
 *   { lines, subtotal, discount, base, taxAmount, total, taxRate, mode, showQuantities, valid }
 * `valid` es false si algún importe o cantidad no se puede interpretar.
 */
export function computeTotals(proposal) {
  const items = filledPriceItems(proposal.priceItems)
  let valid = items.length > 0
  const lines = items.map((item) => {
    const unit = parseAmountToCents(item.unitPrice)
    const qty = parseQuantity(item.quantity)
    const unitOk = unit !== null && !Number.isNaN(unit) && unit >= 0
    const qtyOk = !Number.isNaN(qty)
    if (!unitOk || !qtyOk) valid = false
    const unitCents = unitOk ? unit : 0
    const qtyHundredths = qtyOk ? qty : 100
    return {
      id: item.id,
      concept: (item.concept ?? '').trim(),
      quantity: qtyHundredths / 100,
      unitCents,
      cents: Math.round((unitCents * qtyHundredths) / 100),
    }
  })

  const subtotal = lines.reduce((sum, l) => sum + l.cents, 0)
  const discount = computeDiscount(proposal.discount, subtotal)
  const base = subtotal - discount.cents

  const mode = proposal.tax?.mode || ''
  const rate = parsePercent(proposal.tax?.rate)
  const hasRate = mode === 'excluded' && typeof rate === 'number' && !Number.isNaN(rate)
  const taxAmount = hasRate ? Math.round((base * rate) / 100) : 0

  return {
    lines,
    subtotal,
    discount,
    base,
    mode,
    taxRate: hasRate ? rate : null,
    taxAmount,
    total: base + taxAmount,
    showQuantities: lines.some((l) => l.quantity !== 1),
    valid: valid && discount.valid,
  }
}
