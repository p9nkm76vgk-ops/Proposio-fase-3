// Pruebas automáticas de la lógica (sin navegador). Ejecutar con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatCents, parseAmountToCents, parsePercent, slugify, parseISODate, formatLongDate } from './format.js'
import { computeTotals } from './pricing.js'
import { createEmptyProposal, createSampleProposal, normalizeProposal, setIn, hasUserContent, duplicateProposal } from './proposal.js'
import { accentPalette, contrastRatio, ACCENT_PRESETS } from './templates.js'
import { validateProposal } from './validation.js'
import { buildDocument } from './document.js'
import { toPdfSafeText } from './pdfText.js'
import { proposalFileName } from './pdf.js'

// localStorage simulado para probar el contador mensual
const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
}
const { getUsage, registerExport, monthKey } = await import('./usage.js')
const { addSnippet, loadSnippets, removeSnippet, MAX_SNIPPETS_PER_FIELD } = await import('./snippets.js')
const { loadProfile, saveProfile } = await import('./profile.js')

test('parseAmountToCents entiende el formato español', () => {
  assert.equal(parseAmountToCents('1.250,50'), 125050)
  assert.equal(parseAmountToCents('1250,5'), 125050)
  assert.equal(parseAmountToCents('1250'), 125000)
  assert.equal(parseAmountToCents('1.250'), 125000)
  assert.equal(parseAmountToCents('1250.50'), 125050)
  assert.equal(parseAmountToCents('1,250.50'), 125050)
  assert.equal(parseAmountToCents('1.000.000'), 100000000)
  assert.equal(parseAmountToCents(' 650 € '), 65000)
  assert.equal(parseAmountToCents('0'), 0)
  assert.equal(parseAmountToCents(''), null)
  assert.ok(Number.isNaN(parseAmountToCents('abc')))
  assert.ok(Number.isNaN(parseAmountToCents('1,234')))
  assert.ok(Number.isNaN(parseAmountToCents('12.34.5')))
  assert.ok(Number.isNaN(parseAmountToCents('1.2,50')))
  assert.equal(parseAmountToCents('-50'), -5000)
})

test('formatCents usa formato español con espacios normales', () => {
  assert.equal(formatCents(125050), '1.250,50 €')
  assert.equal(formatCents(5), '0,05 €')
  assert.equal(formatCents(100000000), '1.000.000,00 €')
  assert.ok(!/[  ]/.test(formatCents(123456789)))
})

test('parsePercent', () => {
  assert.equal(parsePercent('21'), 21)
  assert.equal(parsePercent('10,5'), 10.5)
  assert.equal(parsePercent('7 %'), 7)
  assert.equal(parsePercent(''), null)
  assert.ok(Number.isNaN(parsePercent('veinte')))
})

test('fechas: validación y formato largo', () => {
  assert.equal(formatLongDate(parseISODate('2026-10-12')), '12 de octubre de 2026')
  assert.equal(parseISODate('2026-02-30'), null)
  assert.equal(parseISODate(''), null)
})

test('computeTotals no inventa impuestos', () => {
  const p = createEmptyProposal()
  p.priceItems = [
    { id: 'a', concept: 'Diseño', quantity: '1', unitPrice: '650' },
    { id: 'b', concept: 'Desarrollo', quantity: '', unitPrice: '1.100,10' }, // cantidad vacía = 1
    { id: 'c', concept: '', quantity: '1', unitPrice: '' }, // fila vacía: se ignora
  ]
  p.tax = { mode: 'excluded', rate: '', label: 'IVA' }
  let t = computeTotals(p)
  assert.equal(t.subtotal, 175010)
  assert.equal(t.taxAmount, 0)
  assert.equal(t.total, 175010)
  assert.equal(t.lines.length, 2)

  p.tax.rate = '21'
  t = computeTotals(p)
  assert.equal(t.taxAmount, 36752) // 1750,10 × 0,21 = 367,521 → 367,52
  assert.equal(t.total, 211762)

  p.tax.mode = 'included' // con impuestos incluidos no se suma nada aunque haya porcentaje
  t = computeTotals(p)
  assert.equal(t.total, 175010)
  assert.equal(t.taxRate, null)
})

test('una propuesta vacía muestra todos los errores obligatorios', () => {
  const errors = validateProposal(createEmptyProposal())
  for (const key of [
    'professional.name', 'client.name', 'project.title', 'objective', 'service', 'deliverables',
    'timeline', 'priceItems', 'tax.mode', 'paymentTerms', 'revisions', 'nextSteps',
  ]) {
    assert.ok(errors[key], `debería faltar ${key}`)
  }
  assert.equal(errors['exclusions'], undefined) // opcional
  assert.equal(errors['project.date'], undefined) // se rellena con hoy
})

test('la propuesta de ejemplo es válida', () => {
  assert.deepEqual(validateProposal(createSampleProposal()), {})
})

test('validación de importes, porcentaje y validez', () => {
  const p = createSampleProposal()
  const id = p.priceItems[0].id
  p.priceItems[0].unitPrice = 'mil euros'
  p.tax.rate = '150'
  p.project.validityDays = '0'
  const errors = validateProposal(p)
  assert.ok(errors[`priceItems.${id}.unitPrice`])
  assert.ok(errors['tax.rate'])
  assert.ok(errors['project.validityDays'])
})

test('buildDocument respeta el contenido y omite secciones vacías', () => {
  const p = createSampleProposal()
  p.exclusions = ''
  const doc = buildDocument(p)
  const keys = doc.sections.map((s) => s.key)
  assert.ok(!keys.includes('exclusions'))
  assert.deepEqual(keys, [
    'introduction', 'objective', 'service', 'deliverables', 'timeline', 'pricing', 'paymentTerms', 'revisions', 'nextSteps',
  ])
  assert.equal(doc.sections[0].number, '01')
  const pricing = doc.sections.find((s) => s.key === 'pricing')
  assert.equal(pricing.totals.at(-1).value, '2.565,20 €') // (650+1100+250+120) × 1,21
  assert.ok(doc.validUntil.length > 0)
  const next = doc.sections.find((s) => s.key === 'nextSteps')
  assert.equal(next.ordered, true)
  assert.equal(next.items.length, 3)
})

test('la presentación sugerida solo usa datos del usuario', () => {
  const p = createEmptyProposal()
  p.professional.name = 'Ana'
  p.client.name = 'ACME'
  p.project.title = 'Logo'
  const doc = buildDocument(p)
  assert.match(doc.sections[0].text, /Ana presenta a ACME esta propuesta para el proyecto «Logo»/)
  p.introduction = 'Texto propio'
  assert.equal(buildDocument(p).sections[0].text, 'Texto propio')
})

test('nota de impuestos según el tratamiento elegido', () => {
  const p = createSampleProposal()
  p.tax = { mode: 'unspecified', rate: '', label: 'IVA' }
  let pricing = buildDocument(p).sections.find((s) => s.key === 'pricing')
  assert.match(pricing.note, /no especifica/)
  p.tax.mode = 'included'
  pricing = buildDocument(p).sections.find((s) => s.key === 'pricing')
  assert.match(pricing.note, /incluyen impuestos/)
  assert.equal(pricing.totals.length, 1)
})

test('toPdfSafeText conserva el español y limpia lo no representable', () => {
  assert.equal(toPdfSafeText('¿Año? ¡Sí! «ñandú» 1.250 € — ok'), '¿Año? ¡Sí! «ñandú» 1.250 € — ok')
  assert.equal(toPdfSafeText('Hola 👋 mundo'), 'Hola  mundo')
  assert.equal(toPdfSafeText('a b c'), 'a b c')
})

test('nombre de archivo del PDF', () => {
  const p = createSampleProposal()
  assert.match(proposalFileName(p), /^propuesta-panaderia-la-espiga-[a-z0-9-]+\.pdf$/)
  assert.equal(slugify('  Árbol & Cía.  '), 'arbol-cia')
})

test('normalizeProposal recupera borradores y rechaza datos corruptos', () => {
  assert.equal(normalizeProposal(null), null)
  assert.equal(normalizeProposal({ foo: 1 }), null)
  const restored = normalizeProposal({ id: 'x', client: { name: 'ACME' }, tax: { mode: 'hack' } })
  assert.equal(restored.client.name, 'ACME')
  assert.equal(restored.tax.mode, '')
  assert.equal(restored.deliverables.length, 1)
})

test('setIn no modifica el original', () => {
  const p = createEmptyProposal()
  const next = setIn(p, ['client', 'name'], 'Nuevo')
  assert.equal(p.client.name, '')
  assert.equal(next.client.name, 'Nuevo')
  assert.equal(hasUserContent(p), false)
  assert.equal(hasUserContent(next), true)
})

test('límite mensual local: 3 propuestas distintas, re-descarga gratis, reinicio mensual', () => {
  store.clear()
  const oct = new Date(2026, 9, 12)
  assert.equal(monthKey(oct), '2026-10')
  for (const id of ['a', 'b', 'c']) {
    assert.equal(getUsage(id, oct).canExport, true)
    registerExport(id, oct)
  }
  assert.equal(getUsage('d', oct).canExport, false)
  assert.equal(getUsage('a', oct).canExport, true) // ya contada
  registerExport('a', oct)
  assert.equal(getUsage('x', oct).used, 3)
  const nov = new Date(2026, 10, 1)
  assert.equal(getUsage('d', nov).used, 0)
  assert.equal(getUsage('d', nov).canExport, true)
})

// ───────────── Fase 2 ─────────────

test('cantidades × precio y columnas de cantidad', () => {
  const p = createSampleProposal()
  const t = computeTotals(p)
  assert.equal(t.subtotal, 212000) // 650 + 5×220 + 250 + 2×60
  assert.equal(t.showQuantities, true)
  const pricing = buildDocument(p).sections.find((s) => s.key === 'pricing')
  const dev = pricing.rows.find((r) => r.concept === 'Desarrollo de páginas')
  assert.deepEqual([dev.quantity, dev.unitPrice, dev.value], ['5', '220,00 €', '1.100,00 €'])
  p.priceItems[1].quantity = '2,5'
  assert.equal(computeTotals(p).lines[1].cents, 55000)
})

test('descuento por porcentaje e importe, antes de impuestos', () => {
  const p = createSampleProposal()
  p.discount = { mode: 'percent', value: '10' }
  let t = computeTotals(p)
  assert.equal(t.discount.cents, 21200)
  assert.equal(t.base, 190800)
  assert.equal(t.taxAmount, 40068)
  assert.equal(t.total, 230868)
  const labels = buildDocument(p).sections.find((s) => s.key === 'pricing').totals.map((r) => r.label)
  assert.deepEqual(labels, ['Suma de conceptos', 'Descuento (10 %)', 'Base imponible', 'IVA (21 %)', 'Total'])

  p.discount = { mode: 'amount', value: '100' }
  t = computeTotals(p)
  assert.equal(t.total, 244420)
  assert.deepEqual(validateProposal(p), {})

  p.discount = { mode: 'amount', value: '99999' }
  assert.ok(validateProposal(p)['discount.value'])
  p.discount = { mode: 'percent', value: '0' }
  assert.ok(validateProposal(p)['discount.value'])
  p.discount = { mode: 'percent', value: '' }
  assert.ok(validateProposal(p)['discount.value'])
})

test('cantidad no válida', () => {
  const p = createSampleProposal()
  const id = p.priceItems[0].id
  p.priceItems[0].quantity = '0'
  assert.ok(validateProposal(p)[`priceItems.${id}.quantity`])
  p.priceItems[0].quantity = 'dos'
  assert.ok(validateProposal(p)[`priceItems.${id}.quantity`])
})

test('plazos: texto o fases; fase sin nombre da error', () => {
  const p = createSampleProposal()
  p.timeline = ''
  assert.equal(validateProposal(p).timeline, undefined) // hay fases
  p.phases = []
  assert.ok(validateProposal(p).timeline)
  p.phases = [{ id: 'x', name: '', duration: 'Semana 1' }]
  const errors = validateProposal(p)
  assert.ok(errors['phases.x.name'])
  const doc = buildDocument(createSampleProposal())
  const timeline = doc.sections.find((s) => s.key === 'timeline')
  assert.equal(timeline.type, 'timeline')
  assert.equal(timeline.phases.length, 3)
})

test('detalle de entregables', () => {
  const p = createSampleProposal()
  const items = buildDocument(p).sections.find((s) => s.key === 'deliverables').items
  assert.ok(items[0].detail.length > 0)
  assert.equal(items[1].detail, '')
  p.deliverables.push({ id: 'z', text: '', detail: 'Sin entregable' })
  assert.ok(validateProposal(p)['deliverables.z.text'])
})

test('migración de borradores de la versión 1', () => {
  const v1 = {
    id: 'old', client: { name: 'ACME' },
    priceItems: [{ id: 'i1', concept: 'Logo', amount: '300' }],
    deliverables: [{ id: 'd1', text: 'Logo' }],
  }
  const p = normalizeProposal(v1)
  assert.equal(p.schemaVersion, 2)
  assert.deepEqual(p.priceItems[0], { id: 'i1', concept: 'Logo', quantity: '1', unitPrice: '300' })
  assert.equal(p.deliverables[0].detail, '')
  assert.deepEqual(p.phases, [])
  assert.equal(p.discount.mode, 'none')
  assert.equal(p.design.template, 'classic')
})

test('diseño: valores no válidos vuelven a los predeterminados', () => {
  const p = normalizeProposal({ id: 'x', design: { template: 'hack', accent: 'red', logo: { dataUrl: 'javascript:alert(1)', width: 1, height: 1 } } })
  assert.equal(p.design.template, 'classic')
  assert.equal(p.design.accent, '#20375A')
  assert.equal(p.design.logo, null)
})

test('colores: el texto de acento siempre se lee sobre blanco', () => {
  for (const hex of ['#F2C94C', '#FFFFFF', '#00FF00', ...ACCENT_PRESETS.map((c) => c.value)]) {
    const pal = accentPalette(hex)
    assert.ok(contrastRatio(pal.text, [255, 255, 255]) >= 4.5, hex)
    assert.ok(contrastRatio(pal.onAccent, pal.accent) >= 3, hex)
  }
  for (const c of ACCENT_PRESETS) {
    assert.deepEqual(accentPalette(c.value).onAccent, [255, 255, 255], `${c.label} usa texto blanco`)
  }
})

test('duplicar crea una propuesta nueva con los mismos datos', () => {
  const p = createSampleProposal()
  const copy = duplicateProposal(p)
  assert.notEqual(copy.id, p.id)
  assert.equal(copy.project.title, `${p.project.title} (copia)`)
  assert.equal(copy.priceItems.length, p.priceItems.length)
  assert.notEqual(copy.priceItems[0].id, p.priceItems[0].id)
  assert.equal(copy.paymentTerms, p.paymentTerms)
})

test('textos guardados: añadir, evitar duplicados, límite y eliminar', () => {
  store.clear()
  assert.equal(addSnippet('paymentTerms', '  ').ok, false)
  const r1 = addSnippet('paymentTerms', '50 % al aceptar')
  assert.equal(r1.ok, true)
  assert.equal(addSnippet('paymentTerms', '50 % al aceptar').reason, 'duplicate')
  for (let i = 1; i < MAX_SNIPPETS_PER_FIELD; i++) addSnippet('paymentTerms', `Texto ${i}`)
  assert.equal(addSnippet('paymentTerms', 'Uno más').reason, 'full')
  assert.equal(loadSnippets('exclusions').length, 0) // cada campo va por separado
  const first = loadSnippets('paymentTerms')[0]
  assert.equal(removeSnippet('paymentTerms', first.id).length, MAX_SNIPPETS_PER_FIELD - 1)
})

test('perfil: guarda tus datos y diseño para la próxima propuesta', () => {
  store.clear()
  assert.equal(loadProfile(), null)
  const p = createSampleProposal()
  p.design = { template: 'modern', accent: '#7A2335', logo: null }
  saveProfile(p)
  const profile = loadProfile()
  const next = createEmptyProposal(profile)
  assert.equal(next.professional.name, p.professional.name)
  assert.equal(next.design.template, 'modern')
  assert.equal(next.client.name, '')
})

// ───────────── Fase 3 ─────────────

async function loadConfigWith(cfg) {
  globalThis.window.PROPOSIO_CONFIG = cfg
  const original = console.error
  console.error = () => {} // la configuración avisa por consola de los errores; aquí no hace falta verlos
  try {
    return await import(`./config.js?t=${Math.random()}`)
  } finally {
    console.error = original
  }
}

test('configuración: vacía = sin cuentas; válida = con cuentas', async () => {
  let c = await loadConfigWith({ supabaseUrl: '', supabaseAnonKey: '' })
  assert.equal(c.SUPABASE_URL, '')
  assert.equal(c.CONFIG_PROBLEM, null)
  c = await loadConfigWith({ supabaseUrl: ' https://abcd.supabase.co/ ', supabaseAnonKey: 'clave-publica' })
  assert.equal(c.SUPABASE_URL, 'https://abcd.supabase.co')
  assert.equal(c.SUPABASE_ANON_KEY, 'clave-publica')
})

test('configuración: rechaza URL no válida y claves secretas', async () => {
  let c = await loadConfigWith({ supabaseUrl: 'http://inseguro.com', supabaseAnonKey: 'x' })
  assert.equal(c.SUPABASE_URL, '')
  assert.match(c.CONFIG_PROBLEM, /https/)
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')
  c = await loadConfigWith({ supabaseUrl: 'https://abcd.supabase.co', supabaseAnonKey: `eyJhbGciOiJIUzI1NiJ9.${payload}.firma` })
  assert.equal(c.SUPABASE_ANON_KEY, '')
  assert.match(c.CONFIG_PROBLEM, /SECRETA/)
  c = await loadConfigWith({ supabaseUrl: 'https://abcd.supabase.co', supabaseAnonKey: 'sb_secret_123' })
  assert.equal(c.SUPABASE_ANON_KEY, '')
  const anon = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')
  c = await loadConfigWith({ supabaseUrl: 'https://abcd.supabase.co', supabaseAnonKey: `eyJ.${anon}.firma` })
  assert.equal(c.CONFIG_PROBLEM, null)
  delete globalThis.window.PROPOSIO_CONFIG
})

test('textos guardados: cambian entre navegador y cuenta sin mezclarse', async () => {
  const { setCloudSnippetStore, setLocalSnippetStore, readLocalSnippets } = await import('./snippets.js')
  store.clear()
  addSnippet('revisions', 'Local')
  const writes = []
  setCloudSnippetStore({ revisions: [{ id: 'c1', text: 'De la cuenta' }] }, (all) => writes.push(all))
  assert.deepEqual(loadSnippets('revisions').map((s) => s.text), ['De la cuenta'])
  addSnippet('revisions', 'Nuevo en la cuenta')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].revisions.length, 2)
  assert.deepEqual(readLocalSnippets().revisions.map((s) => s.text), ['Local']) // el navegador no se toca
  setLocalSnippetStore()
  assert.deepEqual(loadSnippets('revisions').map((s) => s.text), ['Local'])
})
