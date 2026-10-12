// Modelo de datos de una propuesta.
// Toda la app trabaja con este objeto. Cuando más adelante haya backend (fase 3),
// este mismo formato es el que se guardará en la base de datos.
//
// Versión 2 (fase 2): diseño (plantilla, color, logotipo), cantidades y descuento,
// fases del proyecto y detalle de entregables. Los borradores de la versión 1 se
// convierten automáticamente (ver normalizeProposal).

import { todayISO } from './format.js'
import { DEFAULT_ACCENT, DEFAULT_TEMPLATE, isHexColor, isTemplate } from './templates.js'

export const SCHEMA_VERSION = 2

/** Tratamiento de impuestos. La clave se guarda; la etiqueta se muestra. */
export const TAX_MODES = [
  { value: 'excluded', label: 'Impuestos no incluidos', hint: 'Los importes son sin impuestos. Puedes indicar el porcentaje para calcular el total.' },
  { value: 'included', label: 'Impuestos incluidos', hint: 'Los importes ya incluyen los impuestos correspondientes.' },
  { value: 'unspecified', label: 'No especificado', hint: 'La propuesta indicará que no se especifica el tratamiento de impuestos.' },
]

export const DISCOUNT_MODES = [
  { value: 'none', label: 'Sin descuento' },
  { value: 'percent', label: 'Porcentaje' },
  { value: 'amount', label: 'Importe fijo' },
]

let fallbackCounter = 0
export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackCounter += 1
  return `id-${Date.now().toString(36)}-${fallbackCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export function createDeliverable(text = '', detail = '') {
  return { id: createId(), text, detail }
}

export function createPriceItem(concept = '', unitPrice = '', quantity = '1') {
  return { id: createId(), concept, quantity, unitPrice }
}

export function createPhase(name = '', duration = '') {
  return { id: createId(), name, duration }
}

export function createDefaultDesign() {
  return { template: DEFAULT_TEMPLATE, accent: DEFAULT_ACCENT, logo: null }
}

/**
 * Propuesta vacía. Opcionalmente conserva los datos del profesional y el diseño
 * (para no tener que escribirlos ni configurarlos de nuevo en cada propuesta).
 */
export function createEmptyProposal({ professional, design } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    createdAt: new Date().toISOString(),
    design: normalizeDesign(design),
    professional: {
      name: professional?.name ?? '',
      contact: professional?.contact ?? '',
    },
    client: { name: '', contact: '' },
    project: { title: '', date: todayISO(), validityDays: '' },
    introduction: '',
    objective: '',
    service: '',
    deliverables: [createDeliverable()],
    timeline: '',
    phases: [],
    priceItems: [createPriceItem()],
    discount: { mode: 'none', value: '' },
    tax: { mode: '', rate: '', label: 'IVA' },
    paymentTerms: '',
    revisions: '',
    exclusions: '',
    nextSteps: '',
  }
}

/** Datos de ejemplo, claramente ficticios, para probar la app en segundos. */
export function createSampleProposal({ design } = {}) {
  return {
    ...createEmptyProposal({ design }),
    professional: {
      name: 'Laura Martín · Diseño y desarrollo web',
      contact: 'hola@lauramartin.example · 600 000 000',
    },
    client: { name: 'Panadería La Espiga', contact: 'A la atención de Jorge Ruiz' },
    project: { title: 'Nueva web corporativa con pedidos por encargo', date: todayISO(), validityDays: '30' },
    introduction: '',
    objective:
      'La Espiga quiere dejar de gestionar los encargos por teléfono y WhatsApp. Necesita una web actual, rápida en el móvil, que muestre sus productos y permita a los clientes reservar pedidos para recoger en tienda.',
    service:
      'Diseño y desarrollo de una web de 5 páginas adaptada a móvil, con catálogo de productos editable y un formulario de encargos que envía cada pedido por correo electrónico a la panadería.\n\nIncluye una sesión de formación de una hora para que el equipo pueda actualizar productos y horarios sin ayuda.',
    deliverables: [
      createDeliverable('Diseño visual de la página de inicio y de una página interior', 'Se entregan en formato navegable para revisarlos en el móvil y en el ordenador.'),
      createDeliverable('Web de 5 páginas: Inicio, Productos, Encargos, Nosotros y Contacto'),
      createDeliverable('Catálogo de productos editable desde un panel sencillo'),
      createDeliverable('Formulario de encargos con aviso por correo electrónico'),
      createDeliverable('Sesión de formación de 1 hora y guía rápida en PDF'),
    ],
    timeline:
      'Duración estimada: 4 semanas desde la aceptación de la propuesta y la entrega de textos y fotografías.',
    phases: [
      createPhase('Diseño visual', 'Semana 1'),
      createPhase('Desarrollo y catálogo', 'Semanas 2 y 3'),
      createPhase('Revisión, ajustes y publicación', 'Semana 4'),
    ],
    priceItems: [
      createPriceItem('Diseño visual (inicio + página interior)', '650'),
      createPriceItem('Desarrollo de páginas', '220', '5'),
      createPriceItem('Formulario de encargos', '250'),
      createPriceItem('Formación (horas)', '60', '2'),
    ],
    discount: { mode: 'none', value: '' },
    tax: { mode: 'excluded', rate: '21', label: 'IVA' },
    paymentTerms:
      '50 % a la aceptación de la propuesta y 50 % a la publicación de la web, mediante transferencia bancaria en un plazo de 15 días desde la emisión de cada factura.',
    revisions: 'Dos rondas de cambios sobre el diseño y una ronda de ajustes sobre la web terminada.',
    exclusions:
      'Redacción de textos y fotografía de producto.\nDominio y alojamiento web (se contratan a nombre del cliente).\nPasarela de pago online.\nMantenimiento posterior a la publicación.',
    nextSteps:
      'Responder a este correo confirmando la aceptación.\nAbonar el primer pago para reservar la fecha de inicio.\nEnviar textos, logotipo y fotografías disponibles.',
  }
}

/** ¿Tiene la propuesta algo escrito por el usuario? (para avisar antes de borrar) */
export function hasUserContent(p) {
  if (!p) return false
  const texts = [
    p.client?.name, p.client?.contact, p.project?.title, p.introduction, p.objective,
    p.service, p.timeline, p.paymentTerms, p.revisions, p.exclusions, p.nextSteps,
    ...(p.deliverables ?? []).flatMap((d) => [d.text, d.detail]),
    ...(p.phases ?? []).flatMap((ph) => [ph.name, ph.duration]),
    ...(p.priceItems ?? []).flatMap((i) => [i.concept, i.unitPrice]),
  ]
  return texts.some((t) => typeof t === 'string' && t.trim() !== '')
}

/** Logotipo guardado: imagen PNG/JPEG en data URL con sus dimensiones. */
export function normalizeLogo(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { dataUrl, width, height } = raw
  if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(dataUrl)) return null
  if (!(width > 0 && height > 0)) return null
  return { dataUrl, width: Number(width), height: Number(height), name: typeof raw.name === 'string' ? raw.name : '' }
}

export function normalizeDesign(raw) {
  return {
    template: isTemplate(raw?.template) ? raw.template : DEFAULT_TEMPLATE,
    accent: isHexColor(raw?.accent) ? raw.accent.toUpperCase() : DEFAULT_ACCENT,
    logo: normalizeLogo(raw?.logo),
  }
}

/**
 * Comprueba que un objeto guardado (p. ej. en localStorage) tiene la forma esperada
 * y completa los campos que falten. Convierte borradores antiguos (versión 1).
 * Si no es válido, devuelve null.
 */
export function normalizeProposal(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const base = createEmptyProposal()
  const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback)
  const list = (arr, make) =>
    Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object').map(make) : null

  const deliverables = list(raw.deliverables, (d) => ({
    id: str(d.id) || createId(),
    text: str(d.text),
    detail: str(d.detail),
  }))
  const priceItems = list(raw.priceItems, (i) => ({
    id: str(i.id) || createId(),
    concept: str(i.concept),
    quantity: str(i.quantity, '1'),
    // En la versión 1 el campo se llamaba "amount" (importe sin cantidad).
    unitPrice: str(i.unitPrice, str(i.amount)),
  }))
  const phases = list(raw.phases, (ph) => ({ id: str(ph.id) || createId(), name: str(ph.name), duration: str(ph.duration) }))
  const discountMode = DISCOUNT_MODES.some((m) => m.value === raw.discount?.mode) ? raw.discount.mode : 'none'

  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    id: raw.id,
    createdAt: str(raw.createdAt, base.createdAt),
    design: normalizeDesign(raw.design),
    professional: { name: str(raw.professional?.name), contact: str(raw.professional?.contact) },
    client: { name: str(raw.client?.name), contact: str(raw.client?.contact) },
    project: {
      title: str(raw.project?.title),
      date: str(raw.project?.date, base.project.date),
      validityDays: str(raw.project?.validityDays),
    },
    introduction: str(raw.introduction),
    objective: str(raw.objective),
    service: str(raw.service),
    deliverables: deliverables?.length ? deliverables : base.deliverables,
    timeline: str(raw.timeline),
    phases: phases ?? [],
    priceItems: priceItems?.length ? priceItems : base.priceItems,
    discount: { mode: discountMode, value: str(raw.discount?.value) },
    tax: {
      mode: TAX_MODES.some((m) => m.value === raw.tax?.mode) ? raw.tax.mode : '',
      rate: str(raw.tax?.rate),
      label: str(raw.tax?.label, 'IVA'),
    },
    paymentTerms: str(raw.paymentTerms),
    revisions: str(raw.revisions),
    exclusions: str(raw.exclusions),
    nextSteps: str(raw.nextSteps),
  }
}

/** Copia de una propuesta con identificador nuevo (cuenta como propuesta nueva). */
export function duplicateProposal(p) {
  const copy = normalizeProposal(JSON.parse(JSON.stringify(p)))
  return {
    ...copy,
    id: createId(),
    createdAt: new Date().toISOString(),
    project: { ...copy.project, title: copy.project.title ? `${copy.project.title} (copia)` : '', date: todayISO() },
    deliverables: copy.deliverables.map((d) => ({ ...d, id: createId() })),
    phases: copy.phases.map((ph) => ({ ...ph, id: createId() })),
    priceItems: copy.priceItems.map((i) => ({ ...i, id: createId() })),
  }
}

/** Actualiza un valor anidado sin modificar el objeto original: setIn(p, ['client','name'], 'Ana') */
export function setIn(obj, path, value) {
  const [key, ...rest] = path
  const copy = Array.isArray(obj) ? [...obj] : { ...obj }
  copy[key] = rest.length ? setIn(obj?.[key] ?? {}, rest, value) : value
  return copy
}
