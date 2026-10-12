// Calculadora de precio mínimo por hora.
// Todos los datos los escribe el usuario: aquí no se presupone ningún ingreso,
// gasto ni porcentaje de impuestos. Solo se hace la cuenta y se explica.
//
//   Beneficio antes de impuestos = ingreso neto anual ÷ (1 − % reservado para impuestos)
//   Facturación necesaria        = beneficio antes de impuestos + gastos anuales
//   Horas facturables al año     = horas facturables por semana × (52 − semanas sin facturar)
//   Precio mínimo por hora       = facturación necesaria ÷ horas facturables

import { parseAmountToCents, parsePercent } from './format.js'
import { createSyncedStore } from './storage.js'

export const rateStore = createSyncedStore('proposio.rate.v1', {})

export const RATE_FIELDS = ['netMonthly', 'expensesMonthly', 'taxReservePercent', 'billableHoursWeek', 'weeksOff']

/** Ajustes guardados, siempre con todas las claves como texto. */
export function normalizeRateSettings(raw) {
  const out = {}
  for (const key of RATE_FIELDS) out[key] = typeof raw?.[key] === 'string' ? raw[key].slice(0, 16) : ''
  return out
}

export function loadRateSettings() {
  return normalizeRateSettings(rateStore.read())
}

export function saveRateSettings(settings) {
  return rateStore.write(normalizeRateSettings(settings))
}

/** Número decimal escrito en español ("37,5") o null si está vacío / NaN si no es válido. */
function parseNumber(raw) {
  const hundredths = parseAmountToCents(raw)
  if (hundredths === null) return null
  if (Number.isNaN(hundredths)) return NaN
  return hundredths / 100
}

/**
 * Devuelve { complete, errors, hourlyCents, revenueCents, billableHours }.
 * errors: { campo: mensaje } solo para los campos escritos con un valor imposible.
 */
export function computeMinimumRate(settings) {
  const s = normalizeRateSettings(settings)
  const errors = {}
  const net = parseAmountToCents(s.netMonthly)
  const expenses = s.expensesMonthly.trim() === '' ? 0 : parseAmountToCents(s.expensesMonthly)
  const tax = s.taxReservePercent.trim() === '' ? 0 : parsePercent(s.taxReservePercent)
  const hours = parseNumber(s.billableHoursWeek)
  const weeksOff = s.weeksOff.trim() === '' ? 0 : parseNumber(s.weeksOff)

  if (Number.isNaN(net) || (typeof net === 'number' && net <= 0)) errors.netMonthly = 'Escribe un importe mayor que 0.'
  if (Number.isNaN(expenses) || expenses < 0) errors.expensesMonthly = 'Escribe un importe válido (o 0).'
  if (Number.isNaN(tax) || tax < 0 || tax >= 100) errors.taxReservePercent = 'Escribe un porcentaje entre 0 y 99.'
  if (Number.isNaN(hours) || (typeof hours === 'number' && (hours <= 0 || hours > 80))) {
    errors.billableHoursWeek = 'Escribe entre 1 y 80 horas.'
  }
  if (Number.isNaN(weeksOff) || weeksOff < 0 || weeksOff > 30) errors.weeksOff = 'Escribe entre 0 y 30 semanas.'

  const complete = net !== null && hours !== null && Object.keys(errors).length === 0
  if (!complete) return { complete: false, errors, hourlyCents: null, revenueCents: null, billableHours: null }

  const profitBeforeTax = (net * 12) / (1 - tax / 100)
  const revenueCents = Math.round(profitBeforeTax + expenses * 12)
  const billableHours = hours * (52 - weeksOff)
  return { complete: true, errors, hourlyCents: Math.ceil(revenueCents / billableHours), revenueCents, billableHours }
}

/** Horas estimadas de un proyecto ("12,5") en número, o null si vacío / NaN si no es válido. */
export function parseHours(raw) {
  const n = parseNumber(raw)
  if (n === null) return null
  if (Number.isNaN(n) || n <= 0 || n > 10000) return NaN
  return n
}

/**
 * Compara lo que cobras en esta propuesta con tu mínimo.
 * baseCents: importe sin impuestos añadidos (conceptos − descuento).
 */
export function compareWithMinimum(baseCents, hours, hourlyCents) {
  if (!hours || Number.isNaN(hours) || !hourlyCents || baseCents <= 0) return null
  const minimumCents = Math.round(hourlyCents * hours)
  return {
    minimumCents,
    effectiveHourlyCents: Math.round(baseCents / hours),
    belowMinimum: baseCents < minimumCents,
    gapCents: Math.max(0, minimumCents - baseCents),
  }
}
