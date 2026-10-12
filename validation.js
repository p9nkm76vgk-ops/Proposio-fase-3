// Validación de la propuesta.
// Devuelve un objeto { ruta: mensaje } en el mismo orden que el formulario,
// para poder llevar al usuario al primer error.

import { parseAmountToCents, parsePercent, parseISODate } from './format.js'
import { filledPriceItems, parseQuantity } from './pricing.js'
import { isHexColor, isTemplate } from './templates.js'

/** Longitudes máximas: evitan textos desproporcionados que romperían la maquetación. */
export const LIMITS = {
  shortText: 120,
  contact: 200,
  title: 140,
  longText: 3000,
  listItem: 300,
  detail: 600,
  concept: 200,
  amount: 16,
  quantity: 8,
  phaseName: 120,
  phaseDuration: 60,
  taxLabel: 20,
  maxListItems: 30,
  maxPhases: 12,
}

const required = (value) => typeof value === 'string' && value.trim() !== ''

export function validateProposal(p) {
  const errors = {}
  const add = (path, message) => {
    if (!errors[path]) errors[path] = message
  }

  // 1. Diseño (normalmente siempre válido; se comprueba por si el borrador está dañado)
  if (!isTemplate(p.design?.template)) add('design.template', 'Elige una plantilla.')
  if (!isHexColor(p.design?.accent)) add('design.accent', 'Elige un color válido.')

  // 2. Datos generales
  if (!required(p.professional?.name)) add('professional.name', 'Indica tu nombre o el de tu empresa.')
  if (!required(p.client?.name)) add('client.name', 'Indica el nombre del cliente.')
  if (!required(p.project?.title)) add('project.title', 'Escribe un título para el proyecto.')
  if (!parseISODate(p.project?.date)) add('project.date', 'Selecciona una fecha válida.')

  const validity = (p.project?.validityDays ?? '').trim()
  if (validity !== '') {
    const n = Number(validity)
    if (!/^\d+$/.test(validity) || n < 1 || n > 365) {
      add('project.validityDays', 'Escribe un número de días entre 1 y 365, o déjalo vacío.')
    }
  }

  // 3. Proyecto
  if (!required(p.objective)) add('objective', 'Describe la necesidad u objetivo del cliente.')
  if (!required(p.service)) add('service', 'Describe el servicio que ofreces.')

  // 4. Entregables y plazos
  const deliverables = p.deliverables ?? []
  if (!deliverables.some((d) => required(d.text))) add('deliverables', 'Añade al menos un entregable.')
  for (const d of deliverables) {
    if (!required(d.text) && required(d.detail)) {
      add(`deliverables.${d.id}.text`, 'Escribe el entregable al que corresponde este detalle.')
    }
  }

  const phases = (p.phases ?? []).filter((ph) => required(ph.name) || required(ph.duration))
  for (const ph of phases) {
    if (!required(ph.name)) add(`phases.${ph.id}.name`, 'Escribe el nombre de la fase.')
  }
  if (!required(p.timeline) && phases.length === 0) {
    add('timeline', 'Indica los plazos: escribe un texto o añade al menos una fase.')
  }

  // 5. Precio
  const items = filledPriceItems(p.priceItems)
  if (items.length === 0) {
    add('priceItems', 'Añade al menos un concepto con su precio.')
  }
  let subtotal = 0
  for (const item of items) {
    if (!required(item.concept)) add(`priceItems.${item.id}.concept`, 'Describe este concepto.')
    const qty = parseQuantity(item.quantity)
    if (Number.isNaN(qty)) add(`priceItems.${item.id}.quantity`, 'Cantidad no válida. Ejemplo: 1 o 2,5')
    const cents = parseAmountToCents(item.unitPrice)
    if (cents === null) add(`priceItems.${item.id}.unitPrice`, 'Indica el precio.')
    else if (Number.isNaN(cents)) add(`priceItems.${item.id}.unitPrice`, 'Precio no válido. Ejemplo: 1.250,50')
    else if (cents < 0) add(`priceItems.${item.id}.unitPrice`, 'El precio no puede ser negativo.')
    else if (!Number.isNaN(qty)) subtotal += Math.round((cents * qty) / 100)
  }

  const discountMode = p.discount?.mode ?? 'none'
  if (discountMode === 'percent') {
    const percent = parsePercent(p.discount.value)
    if (percent === null) add('discount.value', 'Indica el porcentaje de descuento.')
    else if (Number.isNaN(percent) || percent <= 0 || percent > 100) {
      add('discount.value', 'Escribe un porcentaje mayor que 0 y como máximo 100.')
    }
  } else if (discountMode === 'amount') {
    const cents = parseAmountToCents(p.discount.value)
    if (cents === null) add('discount.value', 'Indica el importe del descuento.')
    else if (Number.isNaN(cents) || cents <= 0) add('discount.value', 'Importe no válido. Ejemplo: 100 o 99,50')
    else if (cents > subtotal) add('discount.value', 'El descuento no puede ser mayor que la suma de los conceptos.')
  }

  if (!['included', 'excluded', 'unspecified'].includes(p.tax?.mode)) {
    add('tax.mode', 'Elige cómo se tratan los impuestos.')
  } else if (p.tax.mode === 'excluded') {
    const rate = parsePercent(p.tax.rate)
    if (Number.isNaN(rate) || (typeof rate === 'number' && rate > 100)) {
      add('tax.rate', 'Escribe un porcentaje entre 0 y 100, o déjalo vacío.')
    }
    if (typeof rate === 'number' && !Number.isNaN(rate) && !required(p.tax.label)) {
      add('tax.label', 'Indica el nombre del impuesto (por ejemplo, IVA).')
    }
  }

  // 6. Condiciones y próximos pasos
  if (!required(p.paymentTerms)) add('paymentTerms', 'Indica las condiciones de pago.')
  if (!required(p.revisions)) add('revisions', 'Indica cuántas revisiones incluye la propuesta.')
  if (!required(p.nextSteps)) add('nextSteps', 'Explica qué debe hacer el cliente para aceptar.')

  return errors
}

/** Ruta del campo -> id del elemento HTML, para poder enfocar el primer error. */
export function fieldIdFromPath(path) {
  return `f-${path.replace(/\./g, '-')}`
}
