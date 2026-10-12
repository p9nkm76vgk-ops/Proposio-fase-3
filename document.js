// Convierte los datos del formulario en un "documento" estructurado.
// La vista previa (HTML) y el PDF usan este mismo resultado, así ambos muestran
// exactamente el mismo contenido y en el mismo orden.
//
// Regla clave: aquí NO se inventa información. Solo se reorganiza lo que escribió
// el usuario y se añaden frases neutras de enlace (por ejemplo, la presentación sugerida).

import { addDays, cleanText, formatCents, formatLongDate, formatPercent, parseISODate } from './format.js'
import { computeTotals } from './pricing.js'
import { normalizeDesign } from './proposal.js'

/** Texto de presentación sugerido, construido solo con datos del usuario. */
export function suggestedIntroduction(p) {
  const professional = cleanText(p.professional?.name)
  const client = cleanText(p.client?.name)
  const title = cleanText(p.project?.title)
  if (!professional || !client || !title) return ''
  return (
    `${professional} presenta a ${client} esta propuesta para el proyecto «${title}». ` +
    'A continuación se detallan el objetivo, el servicio propuesto, los entregables, ' +
    'los plazos y las condiciones económicas.'
  )
}

/** Divide un texto en líneas no vacías (para listas escritas en un textarea). */
function toLines(text) {
  return cleanText(text)
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
}

/** 2 → "2", 2.5 → "2,5" */
export function formatQuantity(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

function buildTaxNote(totals, taxLabel) {
  switch (totals.mode) {
    case 'included':
      return 'Los importes indicados incluyen impuestos.'
    case 'excluded':
      return totals.taxRate !== null
        ? `Los importes de cada concepto no incluyen impuestos. Se añade ${taxLabel} (${formatPercent(totals.taxRate)}).`
        : 'Los importes indicados no incluyen impuestos.'
    case 'unspecified':
      return 'Esta propuesta no especifica el tratamiento de impuestos.'
    default:
      return ''
  }
}

function buildTotalRows(totals, taxLabel) {
  const rows = []
  const hasDiscount = totals.discount.mode !== 'none' && totals.discount.cents > 0

  if (hasDiscount) {
    rows.push({ label: 'Suma de conceptos', value: formatCents(totals.subtotal) })
    rows.push({
      label: totals.discount.percent !== null ? `Descuento (${formatPercent(totals.discount.percent)})` : 'Descuento',
      value: formatCents(-totals.discount.cents),
    })
  }

  if (totals.mode === 'excluded' && totals.taxRate !== null) {
    rows.push({ label: 'Base imponible', value: formatCents(totals.base) })
    rows.push({ label: `${taxLabel} (${formatPercent(totals.taxRate)})`, value: formatCents(totals.taxAmount) })
    rows.push({ label: 'Total', value: formatCents(totals.total), emphasis: true })
    return rows
  }

  const label = {
    included: 'Total (impuestos incluidos)',
    excluded: 'Total (impuestos no incluidos)',
  }[totals.mode] ?? 'Total'
  rows.push({ label, value: formatCents(totals.total), emphasis: true })
  return rows
}

export function buildDocument(p) {
  const date = parseISODate(p.project?.date)
  const validityDays = Number((p.project?.validityDays ?? '').trim())
  const hasValidity = Number.isInteger(validityDays) && validityDays > 0
  const taxLabel = cleanText(p.tax?.label) || 'Impuestos'
  const totals = computeTotals(p)

  const sections = []
  const addText = (key, title, text) => {
    const value = cleanText(text)
    if (value) sections.push({ key, title, type: 'text', text: value })
  }
  // Cada elemento de lista: { text, detail }
  const addList = (key, title, items, ordered = false) => {
    if (items.length) sections.push({ key, title, type: 'list', items, ordered })
  }

  addText('introduction', 'Presentación', cleanText(p.introduction) || suggestedIntroduction(p))
  addText('objective', 'Necesidad y objetivo', p.objective)
  addText('service', 'Servicio propuesto', p.service)
  addList(
    'deliverables',
    'Entregables',
    (p.deliverables ?? [])
      .filter((d) => cleanText(d.text))
      .map((d) => ({ text: cleanText(d.text), detail: cleanText(d.detail) })),
  )

  const phases = (p.phases ?? [])
    .filter((ph) => cleanText(ph.name))
    .map((ph) => ({ name: cleanText(ph.name), duration: cleanText(ph.duration) }))
  const timelineText = cleanText(p.timeline)
  if (timelineText || phases.length) {
    sections.push({ key: 'timeline', title: 'Plazos', type: 'timeline', text: timelineText, phases })
  }

  if (totals.lines.length > 0) {
    sections.push({
      key: 'pricing',
      title: 'Inversión',
      type: 'pricing',
      showQuantities: totals.showQuantities,
      rows: totals.lines.map((l) => ({
        id: l.id,
        concept: l.concept || 'Concepto sin descripción',
        quantity: formatQuantity(l.quantity),
        unitPrice: formatCents(l.unitCents),
        value: formatCents(l.cents),
      })),
      totals: buildTotalRows(totals, taxLabel),
      note: buildTaxNote(totals, taxLabel),
      valid: totals.valid,
    })
  }

  addText('paymentTerms', 'Condiciones de pago', p.paymentTerms)
  addText('revisions', 'Revisiones incluidas', p.revisions)
  addList('exclusions', 'No incluido en este presupuesto', toLines(p.exclusions).map((text) => ({ text, detail: '' })))
  addList(
    'nextSteps',
    'Próximos pasos para aceptar la propuesta',
    toLines(p.nextSteps).map((text) => ({ text, detail: '' })),
    true,
  )

  return {
    design: normalizeDesign(p.design),
    title: cleanText(p.project?.title),
    professional: { name: cleanText(p.professional?.name), contact: cleanText(p.professional?.contact) },
    client: { name: cleanText(p.client?.name), contact: cleanText(p.client?.contact) },
    issueDate: date ? formatLongDate(date) : '',
    validUntil: date && hasValidity ? formatLongDate(addDays(date, validityDays)) : '',
    validityDays: hasValidity ? validityDays : null,
    sections: sections.map((s, i) => ({ ...s, number: String(i + 1).padStart(2, '0') })),
  }
}
