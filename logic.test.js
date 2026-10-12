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
    'introduction', 'objective', 'service', 'deliverables', 'timeline', 'pricing', 'extras', 'paymentTerms', 'revisions', 'nextSteps',
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

// ───────────── Fase 4 ─────────────
const { getEntitlements, applyEntitlements, PLAN_FEATURES } = await import('./entitlements.js')

test('planes: sin pagos activados, todo disponible para todos', () => {
  const e = getEntitlements('free', false)
  assert.equal(e.gated, false)
  assert.equal(e.templates.length, 3)
  const p = createSampleProposal({ design: { template: 'modern', accent: '#7A2335', logo: null } })
  assert.equal(applyEntitlements(p, e), p)
})

test('planes: con pagos, Gratis usa la plantilla Clásica sin marca (sin tocar lo guardado)', () => {
  const e = getEntitlements('free', true)
  assert.equal(e.gated, true)
  assert.deepEqual(e.templates, ['classic'])
  const logo = { dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10, name: 'l.png' }
  const p = createSampleProposal({ design: { template: 'modern', accent: '#7A2335', logo } })
  const out = applyEntitlements(p, e)
  assert.equal(out.design.template, 'classic')
  assert.equal(out.design.logo, null)
  assert.equal(out.design.accent, '#20375A')
  assert.equal(p.design.template, 'modern') // lo guardado no cambia
  assert.deepEqual(p.design.logo, logo)
})

test('planes: Pro y Business desbloquean todo', () => {
  for (const plan of ['pro', 'business']) {
    const e = getEntitlements(plan, true)
    assert.equal(e.gated, false)
    assert.ok(e.brand && e.snippets && e.history)
  }
})

test('planes: la página de planes solo anuncia funciones que existen', () => {
  const all = [...PLAN_FEATURES.free, ...PLAN_FEATURES.pro, ...PLAN_FEATURES.business].join(' ')
  assert.doesNotMatch(all, /biblioteca|varias marcas|ilimitad/i)
})

// ─── Bloques 1 y 2: enlace, extras, catálogo, ejemplos y precio por hora ─────
const { pricingSummary, totalWithExtras } = await import('./pricing.js')
const { stableStringify, isShareOutdated, newAcceptances, markAcceptancesSeen, needsFollowUp, shareMessage } = await import('./sharing.js')
const { computeMinimumRate, compareWithMinimum, parseHours } = await import('./rate.js')
const { addToCatalog, loadCatalog, removeFromCatalog, priceItemFromCatalog } = await import('./catalog.js')
const { SAMPLE_PROFESSIONS, createProfessionSample } = await import('./samples.js')

test('extras: aparecen aparte, no suman al total y llevan nota de impuestos', () => {
  const p = createSampleProposal()
  p.extras = [{ id: 'e1', concept: 'Fotos', price: '300' }, { id: 'e2', concept: '', price: '' }]
  const doc = buildDocument(p)
  const extras = doc.sections.find((s) => s.key === 'extras')
  assert.deepEqual(extras.rows.map((r) => r.value), ['+300,00 €'])
  assert.match(extras.note, /No están incluidos en el total/)
  assert.match(extras.note, /IVA \(21 %\)/)
  assert.equal(doc.sections.find((s) => s.key === 'pricing').totals.at(-1).value, '2.565,20 €')
  p.extras = []
  assert.ok(!buildDocument(p).sections.some((s) => s.key === 'extras'))
})

test('extras: validación y normalización', () => {
  const p = createSampleProposal()
  p.extras = [{ id: 'a', concept: 'Mantenimiento', price: '' }, { id: 'b', concept: '', price: '50' }, { id: 'c', concept: 'X', price: '-3' }]
  const errors = validateProposal(p)
  assert.ok(errors['extras.a.price'] && errors['extras.b.concept'] && errors['extras.c.price'])
  p.extras = [{ id: 'a', concept: '', price: '' }]
  assert.deepEqual(validateProposal(p), {})
  const n = normalizeProposal({ ...createSampleProposal(), extras: [{ concept: 'Uno', price: '10' }, null, 'x'] })
  assert.equal(n.extras.length, 1)
  assert.ok(n.extras[0].id)
  assert.deepEqual(normalizeProposal({ id: 'z' }).extras, [])
  const copy = duplicateProposal(createSampleProposal())
  assert.equal(copy.extras.length, 1)
})

test('total con extras: misma fórmula que el servidor (descuento solo en conceptos)', () => {
  const p = createSampleProposal()
  p.discount = { mode: 'amount', value: '120' }
  p.extras = [{ id: 'e1', concept: 'Fotos', price: '300' }, { id: 'e2', concept: 'Urgente', price: '50' }]
  const summary = pricingSummary(p)
  assert.deepEqual(summary, {
    base_subtotal: 212000, discount: 12000, tax_mode: 'excluded', tax_rate: 21,
    extras: [{ id: 'e1', concept: 'Fotos', cents: 30000 }, { id: 'e2', concept: 'Urgente', cents: 5000 }],
  })
  assert.equal(totalWithExtras(summary, []).total, 242000) // 2000 × 1,21
  assert.equal(totalWithExtras(summary, ['e1', 'inventado']).total, 278300) // 2300 × 1,21
  p.tax = { mode: 'included', rate: '', label: 'IVA' }
  assert.equal(totalWithExtras(pricingSummary(p), ['e2']).total, 205000)
})

test('plan gratuito con pagos: se quitan los extras de lo que se envía; sin pagos, no', () => {
  const p = createSampleProposal()
  assert.equal(applyEntitlements(p, getEntitlements('free', true)).extras.length, 0)
  assert.equal(p.extras.length, 1) // lo guardado no se toca
  assert.equal(applyEntitlements(p, getEntitlements('free', false)), p)
  assert.equal(applyEntitlements(p, getEntitlements('pro', true)), p)
  assert.equal(getEntitlements('free', true).share, true)
  assert.equal(getEntitlements('free', true).viewTracking, false)
})

test('enlace: detecta cambios aunque la base de datos reordene las claves', () => {
  const p = createSampleProposal()
  // Simula jsonb: mismas claves en otro orden
  const reorder = (v) =>
    Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder(v[k])])) : v
  const fromDb = reorder(JSON.parse(JSON.stringify(p)))
  assert.equal(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] }), stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }))
  assert.equal(isShareOutdated({ snapshot: fromDb }, p), false)
  assert.equal(isShareOutdated({ snapshot: fromDb }, { ...p, objective: 'Otro' }), true)
  assert.equal(isShareOutdated({ snapshot: null }, p), null)
  assert.match(shareMessage(p, 'https://x.example/ver.html?p=abc'), /«Nueva web corporativa con pedidos por encargo»[\s\S]*https:\/\/x\.example/)
})

test('avisos de aceptación: solo los nuevos y recientes, una vez', () => {
  const now = new Date('2026-10-12T10:00:00Z')
  const shares = [
    { token: 't1', status: 'accepted', acceptedAt: '2026-10-11T10:00:00Z' },
    { token: 't2', status: 'accepted', acceptedAt: '2026-09-01T10:00:00Z' }, // antigua
    { token: 't3', status: 'sent', sharedAt: '2026-10-01T10:00:00Z', revoked: false },
  ]
  const fresh = newAcceptances(shares, 'u1', now)
  assert.deepEqual(fresh.map((s) => s.token), ['t1'])
  markAcceptancesSeen(fresh, 'u1')
  assert.deepEqual(newAcceptances(shares, 'u1', now), [])
  assert.equal(newAcceptances(shares, 'otro-usuario', now).length, 1)
  assert.equal(needsFollowUp(shares[2], now), true)
  assert.equal(needsFollowUp({ ...shares[2], sharedAt: '2026-10-10T10:00:00Z' }, now), false)
  assert.equal(needsFollowUp({ ...shares[2], revoked: true }, now), false)
})

test('precio mínimo por hora con los datos del usuario', () => {
  const r = computeMinimumRate({ netMonthly: '1.800', expensesMonthly: '450', taxReservePercent: '20', billableHoursWeek: '25', weeksOff: '6' })
  // (21.600 / 0,8 + 5.400) / (25 × 46) = 32.400 / 1.150 = 28,17 €
  assert.equal(r.complete, true)
  assert.equal(r.revenueCents, 3240000)
  assert.equal(r.billableHours, 1150)
  assert.equal(r.hourlyCents, 2818)
  assert.equal(computeMinimumRate({ netMonthly: '1800' }).complete, false)
  assert.ok(computeMinimumRate({ netMonthly: '1800', billableHoursWeek: '0' }).errors.billableHoursWeek)
  assert.ok(computeMinimumRate({ netMonthly: '1800', billableHoursWeek: '20', taxReservePercent: '100' }).errors.taxReservePercent)
  const c = compareWithMinimum(100000, parseHours('40'), 2818)
  assert.equal(c.belowMinimum, true)
  assert.equal(c.effectiveHourlyCents, 2500)
  assert.equal(c.gapCents, 12720)
  assert.equal(compareWithMinimum(100000, parseHours(''), 2818), null)
  assert.ok(Number.isNaN(parseHours('abc')))
})

test('catálogo de servicios: guardar, evitar duplicados, añadir y borrar', () => {
  assert.equal(loadCatalog().length, 0)
  assert.equal(addToCatalog({ concept: 'Sesión de fotos', unitPrice: '90', quantity: '' }).ok, true)
  assert.equal(addToCatalog({ concept: 'sesión de fotos', unitPrice: '90' }).reason, 'duplicate')
  assert.equal(addToCatalog({ concept: '  ', unitPrice: '90' }).reason, 'empty')
  const [entry] = loadCatalog()
  assert.equal(entry.quantity, '1')
  const item = priceItemFromCatalog(entry)
  assert.equal(item.concept, 'Sesión de fotos')
  assert.notEqual(item.id, entry.id)
  assert.equal(removeFromCatalog(entry.id).length, 0)
})

test('los ejemplos por profesión son completos y válidos', () => {
  assert.equal(SAMPLE_PROFESSIONS.length, 5)
  for (const s of SAMPLE_PROFESSIONS) {
    const p = createProfessionSample(s.id)
    assert.deepEqual(validateProposal(p), {}, s.id)
    assert.ok(computeTotals(p).total > 0, s.id)
    assert.ok(p.extras.length > 0, s.id)
    assert.match(p.professional.contact, /\.example/, s.id) // datos ficticios
  }
})

test('panel de negocio: cifras del mes, tasa y pendientes', async () => {
  const { computeDashboard, reminderMessage } = await import('./sharing.js')
  const now = new Date('2026-10-20T10:00:00Z')
  const shares = [
    { token: 'a', status: 'accepted', revoked: false, sharedAt: '2026-10-02T10:00:00Z', firstViewedAt: '2026-10-03T10:00:00Z', acceptedAt: '2026-10-05T10:00:00Z', acceptedTotalCents: 100000, viewCount: 2 },
    { token: 'b', status: 'accepted', revoked: false, sharedAt: '2026-09-02T10:00:00Z', firstViewedAt: '2026-09-03T10:00:00Z', acceptedAt: '2026-09-05T10:00:00Z', acceptedTotalCents: 50000, viewCount: 1 },
    { token: 'c', status: 'sent', revoked: false, sharedAt: '2026-10-10T10:00:00Z', firstViewedAt: null, viewCount: 0, title: 'Web' },
    { token: 'd', status: 'sent', revoked: false, sharedAt: '2026-10-19T10:00:00Z', firstViewedAt: '2026-10-19T12:00:00Z', viewCount: 1 },
    { token: 'e', status: 'sent', revoked: true, sharedAt: '2026-10-01T10:00:00Z', firstViewedAt: null, viewCount: 0 },
  ]
  const d = computeDashboard(shares, now)
  assert.deepEqual(d.month, { sent: 4, opened: 2, accepted: 1, acceptedCents: 100000 })
  assert.equal(d.acceptanceRate, 50) // 2 aceptadas de 4 activas (la desactivada no cuenta)
  assert.deepEqual(d.pending.map((s) => s.token), ['c'])
  assert.deepEqual(d.waiting.map((s) => s.token), ['d'])
  assert.deepEqual(d.accepted.map((s) => s.token), ['a', 'b'])
  assert.equal(computeDashboard([], now).acceptanceRate, null)
  assert.match(reminderMessage(shares[2], 'https://x.example/ver.html?p=1'), /«Web»[\s\S]*https:\/\/x\.example/)
})
