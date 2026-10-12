// Límite mensual del plan gratuito — CONTROL PROVISIONAL Y LOCAL.
//
// IMPORTANTE: mientras no haya cuentas ni servidor (fase 3), este contador vive en el
// navegador del usuario y cualquiera puede reiniciarlo borrando los datos del sitio.
// Sirve para probar la experiencia del límite, no como medida de seguridad.
// En la fase 3/4 el límite real se aplicará en el servidor.
//
// Regla: una propuesta cuenta la primera vez que se descarga en PDF dentro del mes.
// Volver a descargar la misma propuesta (por ejemplo, tras corregir una errata) no consume otra.

import { readJSON, writeJSON } from './storage.js'

export const FREE_MONTHLY_LIMIT = 3
const USAGE_KEY = 'proposio.usage.v1'

export function monthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function readUsage(now) {
  const month = monthKey(now)
  const stored = readJSON(USAGE_KEY)
  if (!stored || stored.month !== month || !Array.isArray(stored.ids)) {
    return { month, ids: [] } // nuevo mes (o sin datos): el contador empieza en cero
  }
  return { month, ids: stored.ids.filter((id) => typeof id === 'string') }
}

/** Resumen para la interfaz. */
export function getUsage(proposalId, now = new Date()) {
  const { month, ids } = readUsage(now)
  const used = ids.length
  const alreadyCounted = ids.includes(proposalId)
  return {
    month,
    used,
    limit: FREE_MONTHLY_LIMIT,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - used),
    alreadyCounted,
    canExport: alreadyCounted || used < FREE_MONTHLY_LIMIT,
  }
}

/** Registra la descarga de una propuesta. Devuelve false si no se pudo guardar. */
export function registerExport(proposalId, now = new Date()) {
  const usage = readUsage(now)
  if (usage.ids.includes(proposalId)) return true
  return writeJSON(USAGE_KEY, { month: usage.month, ids: [...usage.ids, proposalId] })
}
