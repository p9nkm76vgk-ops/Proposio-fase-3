// Utilidades para enviar una propuesta por enlace (sin llamadas al servidor:
// eso está en cloud.js). Aquí se preparan los mensajes, se detecta si el cliente
// está viendo una versión antigua y se recuerdan las aceptaciones ya avisadas.

import { readJSON, writeJSON } from './storage.js'

/** JSON con las claves ordenadas: sirve para comparar objetos que han pasado por la base de datos. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** ¿Ha cambiado la propuesta desde que se envió el enlace? (null si no se sabe) */
export function isShareOutdated(share, proposal) {
  if (!share?.snapshot || !proposal) return null
  return stableStringify(share.snapshot) !== stableStringify(proposal)
}

/** Mensaje listo para enviar al cliente. Solo usa datos escritos por el usuario. */
export function shareMessage(proposal, url) {
  const title = (proposal.project?.title ?? '').trim()
  const what = title ? `la propuesta «${title}»` : 'la propuesta'
  return `Hola, te envío ${what}. Puedes verla, descargarla en PDF y aceptarla desde este enlace:\n${url}`
}

export function whatsappUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function mailtoUrl(proposal, message) {
  const title = (proposal.project?.title ?? '').trim()
  const subject = title ? `Propuesta: ${title}` : 'Propuesta'
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
}

// ─── Avisos de propuestas aceptadas ──────────────────────────────────────────
// Se recuerda en este navegador qué aceptaciones ya se avisaron, para no repetirlas.

const SEEN_KEY = 'proposio.seenAcceptances'
const NOTIFY_WINDOW_DAYS = 14
const MAX_SEEN = 500

function seenKey(userId) {
  return `${SEEN_KEY}.${userId}`
}

/** Aceptaciones recientes que aún no se han avisado en este navegador. */
export function newAcceptances(shares, userId, now = new Date()) {
  const seen = new Set(readJSON(seenKey(userId)) ?? [])
  const since = now.getTime() - NOTIFY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return shares.filter(
    (s) => s.status === 'accepted' && !seen.has(s.token) && s.acceptedAt && new Date(s.acceptedAt).getTime() >= since,
  )
}

export function markAcceptancesSeen(shares, userId) {
  const seen = readJSON(seenKey(userId)) ?? []
  const next = [...new Set([...seen, ...shares.map((s) => s.token)])].slice(-MAX_SEEN)
  writeJSON(seenKey(userId), next)
}

/** Texto del aviso: uno o varios clientes han aceptado. */
export function acceptanceToast(accepted) {
  if (accepted.length === 1) {
    const s = accepted[0]
    const who = s.acceptedName || s.clientName || 'Tu cliente'
    return `🎉 ${who} ha aceptado «${s.title || 'tu propuesta'}».`
  }
  return `🎉 ${accepted.length} clientes han aceptado tus propuestas.`
}

/** Propuestas enviadas hace días que el cliente todavía no ha aceptado (para hacer seguimiento). */
export const FOLLOW_UP_DAYS = 4

export function needsFollowUp(share, now = new Date()) {
  if (share.status !== 'sent' || share.revoked || !share.sharedAt) return false
  return now.getTime() - new Date(share.sharedAt).getTime() >= FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000
}

/** Mensaje para recordar al cliente una propuesta pendiente. */
export function reminderMessage(share, url) {
  const what = share.title ? `la propuesta «${share.title}»` : 'la propuesta'
  return `Hola, ¿pudiste revisar ${what}? Si tienes cualquier duda, dime. Aquí la tienes de nuevo:\n${url}`
}

/**
 * Cifras del panel de negocio a partir de los enlaces enviados.
 *  - month: lo ocurrido en el mes actual (enviadas, abiertas, aceptadas e importe aceptado)
 *  - acceptanceRate: % de propuestas enviadas que se han aceptado (todas las fechas), o null
 *  - pending: enviadas hace FOLLOW_UP_DAYS días o más sin aceptar (las más antiguas primero)
 *  - accepted: aceptadas, las más recientes primero
 */
export function computeDashboard(shares, now = new Date()) {
  const sameMonth = (iso) => {
    if (!iso) return false
    const d = new Date(iso)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  const active = shares.filter((s) => s.status === 'accepted' || !s.revoked)
  const accepted = shares
    .filter((s) => s.status === 'accepted')
    .sort((a, b) => new Date(b.acceptedAt) - new Date(a.acceptedAt))
  const acceptedThisMonth = accepted.filter((s) => sameMonth(s.acceptedAt))
  return {
    month: {
      sent: shares.filter((s) => sameMonth(s.sharedAt)).length,
      opened: shares.filter((s) => sameMonth(s.firstViewedAt)).length,
      accepted: acceptedThisMonth.length,
      acceptedCents: acceptedThisMonth.reduce((sum, s) => sum + (Number.isInteger(s.acceptedTotalCents) ? s.acceptedTotalCents : 0), 0),
    },
    acceptanceRate: active.length ? Math.round((accepted.length / active.length) * 100) : null,
    pending: shares
      .filter((s) => needsFollowUp(s, now))
      .sort((a, b) => new Date(a.sharedAt) - new Date(b.sharedAt)),
    waiting: shares.filter((s) => s.status === 'sent' && !s.revoked && !needsFollowUp(s, now)),
    accepted,
  }
}
