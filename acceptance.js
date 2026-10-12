// Justificante de aceptación en PDF: deja constancia de quién aceptó una propuesta enviada
// por enlace, cuándo, qué versión, con qué extras y por qué total.
//
// Todo sale de lo registrado en el servidor (accept_shared_proposal) y de la copia de la
// propuesta que vio el cliente. No es una firma electrónica avanzada ni una factura.

import { formatCents, formatPercent, slugify } from './format.js'
import { loadJsPDF } from './jspdfLoader.js'
import { totalWithExtras } from './pricing.js'
import { toPdfSafeText } from './pdfText.js'
import { stableStringify } from './sharing.js'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "12 de octubre de 2026, 21:31 (hora de Madrid)" en la zona horaria del navegador. */
export function formatDateTimeLong(iso, timeZone) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('es-ES', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  const city = zone.includes('/') ? zone.split('/').pop().replace(/_/g, ' ') : zone
  return `${parts.day} de ${MONTHS[Number(parts.month) - 1]} de ${parts.year}, ${parts.hour}:${parts.minute}${city ? ` (hora de ${city})` : ''}`
}

/** Huella SHA-256 de la versión aceptada (para comprobar que nadie la ha cambiado). */
export async function versionFingerprint(snapshot) {
  const bytes = new TextEncoder().encode(stableStringify(snapshot))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Datos del justificante.
 * acceptance: { name, acceptedAt, extras: [{id, concept, cents}], totalCents, sharedAt, token }
 * pricing: resumen guardado al enviar (base_subtotal, discount, tax_mode, tax_rate, extras)
 */
export function acceptanceRecord(proposal, acceptance, pricing = {}, { timeZone } = {}) {
  const extras = Array.isArray(acceptance.extras) ? acceptance.extras : []
  const rows = []
  const hasPricing = Number.isInteger(pricing.base_subtotal)
  if (hasPricing) {
    const totals = totalWithExtras(pricing, extras.map((e) => e.id))
    const base = pricing.base_subtotal - (pricing.discount ?? 0)
    rows.push({ label: pricing.discount ? 'Propuesta (con descuento)' : 'Propuesta', value: formatCents(base) })
    for (const e of extras) rows.push({ label: `Extra: ${e.concept}`, value: `+${formatCents(e.cents)}` })
    if (typeof pricing.tax_rate === 'number') {
      const label = proposal.tax?.label || 'Impuestos'
      rows.push({ label: `${label} (${formatPercent(pricing.tax_rate)})`, value: formatCents(totals.tax) })
    }
  }
  const taxNote =
    typeof pricing.tax_rate === 'number'
      ? 'Impuestos incluidos en el total.'
      : pricing.tax_mode === 'included'
        ? 'Los importes incluyen impuestos.'
        : pricing.tax_mode === 'excluded'
          ? 'Los importes no incluyen impuestos.'
          : 'La propuesta no especifica el tratamiento de impuestos.'

  return {
    title: (proposal.project?.title ?? '').trim() || 'Propuesta sin título',
    professional: (proposal.professional?.name ?? '').trim(),
    professionalContact: (proposal.professional?.contact ?? '').trim(),
    client: (proposal.client?.name ?? '').trim(),
    acceptedBy: acceptance.name ?? '',
    acceptedAt: formatDateTimeLong(acceptance.acceptedAt, timeZone),
    versionSentAt: acceptance.sharedAt ? formatDateTimeLong(acceptance.sharedAt, timeZone) : '',
    reference: acceptance.token ? `…${String(acceptance.token).slice(-8)}` : '',
    rows,
    total: Number.isInteger(acceptance.totalCents) ? formatCents(acceptance.totalCents) : '',
    taxNote,
  }
}

export function acceptanceFileName(proposal) {
  const parts = [slugify(proposal.client?.name, 30), slugify(proposal.project?.title, 40)].filter(Boolean)
  return `justificante-aceptacion-${parts.join('-') || 'propuesta'}.pdf`
}

/** Dibuja el justificante en una instancia de jsPDF (A4). */
export function renderAcceptancePdf(pdf, record, fingerprint = '') {
  const x0 = 20
  const width = 170
  let y = 22
  const ink = [17, 30, 48]
  const text = [55, 65, 81]
  const muted = [107, 114, 128]
  const green = [18, 122, 75]
  const t = (s) => toPdfSafeText(String(s ?? ''))
  const font = (style, size, color) => {
    pdf.setFont('helvetica', style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
  }
  const line = (y1, color = [222, 228, 234], w = 0.3) => {
    pdf.setDrawColor(...color)
    pdf.setLineWidth(w)
    pdf.line(x0, y1, x0 + width, y1)
  }
  const wrapped = (s, size, style, color, maxW = width, lh = 1.45) => {
    font(style, size, color)
    pdf.splitTextToSize(t(s), maxW).forEach((l) => {
      pdf.text(l, x0, y, { baseline: 'top' })
      y += size * 0.3528 * lh
    })
  }

  pdf.setFillColor(...green)
  pdf.rect(0, 0, 210, 3, 'F')
  font('bold', 9, green)
  pdf.text('JUSTIFICANTE DE ACEPTACIÓN', x0, y, { baseline: 'top' })
  y += 7
  wrapped(record.title, 18, 'bold', ink, width, 1.25)
  y += 4

  const field = (label, value) => {
    if (!value) return
    font('bold', 8, muted)
    pdf.text(t(label.toUpperCase()), x0, y, { baseline: 'top' })
    y += 4.5
    wrapped(value, 11, 'normal', ink)
    y += 2.5
  }
  field('Profesional', [record.professional, record.professionalContact].filter(Boolean).join(' · '))
  field('Cliente', record.client)
  field('Aceptada por', record.acceptedBy)
  field('Fecha y hora de la aceptación', record.acceptedAt)
  field('Versión aceptada', record.versionSentAt ? `La enviada el ${record.versionSentAt}` : '')

  y += 2
  line(y, ink, 0.4)
  y += 5
  font('bold', 8, muted)
  pdf.text('IMPORTE ACEPTADO', x0, y, { baseline: 'top' })
  y += 6
  for (const r of record.rows) {
    font('normal', 10.5, text)
    const label = pdf.splitTextToSize(t(r.label), 120)
    label.forEach((l, i) => pdf.text(l, x0, y + i * 5, { baseline: 'top' }))
    pdf.text(t(r.value), x0 + width, y, { baseline: 'top', align: 'right' })
    y += Math.max(1, label.length) * 5 + 1.5
  }
  if (record.total) {
    y += 1
    line(y, ink, 0.4)
    y += 3
    font('bold', 12.5, ink)
    pdf.text('Total aceptado', x0, y, { baseline: 'top' })
    pdf.text(t(record.total), x0 + width, y, { baseline: 'top', align: 'right' })
    y += 8
  }
  wrapped(record.taxNote, 9, 'normal', muted)
  y += 6

  line(y)
  y += 5
  if (record.reference) wrapped(`Referencia del enlace: ${record.reference}`, 8.5, 'normal', muted)
  if (fingerprint) {
    wrapped(`Huella de la versión aceptada (SHA-256): ${fingerprint}`, 8.5, 'normal', muted)
  }
  y += 3
  wrapped(
    'Este justificante recoge la aceptación registrada en proposio a través del enlace de la propuesta: el nombre ' +
      'que escribió quien la aceptó, la fecha y hora del servidor, los extras elegidos y el total calculado por el ' +
      'servidor. proposio no verifica la identidad de quien acepta. No es una firma electrónica avanzada ni una ' +
      'factura, y no implica ningún pago. Las condiciones son las de la propuesta aceptada.',
    8.5,
    'normal',
    muted,
  )

  font('normal', 8, muted)
  pdf.text(t('Generado con proposio'), x0, 284, { baseline: 'top' })
  return pdf
}

/**
 * Genera y descarga el justificante.
 * snapshot: la copia guardada en el servidor tal cual (para calcular la huella igual en ambos lados).
 */
export async function downloadAcceptancePdf(proposal, acceptance, pricing, snapshot = proposal) {
  const JsPDF = await loadJsPDF()
  const record = acceptanceRecord(proposal, acceptance, pricing)
  let fingerprint = ''
  try {
    fingerprint = await versionFingerprint(snapshot)
  } catch {
    // Sin crypto.subtle (página no segura): el justificante sale sin huella
  }
  const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  pdf.setProperties({ title: toPdfSafeText(`Justificante de aceptación: ${record.title}`), creator: 'proposio' })
  renderAcceptancePdf(pdf, record, fingerprint)
  pdf.save(acceptanceFileName(proposal))
}
