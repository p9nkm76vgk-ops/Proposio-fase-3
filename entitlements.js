// Qué incluye cada plan.
//
// Regla de honestidad: mientras los pagos no estén activados (proposio-config.js), todo está
// disponible para todos, porque no sería justo bloquear algo que no se puede comprar.
// Cuando se activan, el plan gratuito sigue siendo útil: crear, editar y descargar en PDF
// con la plantilla profesional básica.
//
// Importante: el límite mensual de propuestas lo aplica el SERVIDOR (supabase.sql).
// Estas reglas solo deciden qué muestra la interfaz.

import { DEFAULT_ACCENT, DEFAULT_TEMPLATE } from './templates.js'

export const PLAN_LABELS = { free: 'Gratis', pro: 'Pro', business: 'Business' }

export const PLAN_LIMITS = { free: 3, pro: 30, business: 300 }

/** Funciones de cada plan, tal como se muestran en la página de planes (solo lo que existe). */
export const PLAN_FEATURES = {
  free: [
    `${PLAN_LIMITS.free} propuestas al mes`,
    'Edición completa y descarga en PDF',
    'Enlace para que tu cliente la vea y la acepte',
    'Ejemplos por profesión y calculadora de precio por hora',
    'Plantilla profesional Clásica',
  ],
  pro: [
    `${PLAN_LIMITS.pro} propuestas al mes`,
    'Saber si tu cliente abrió la propuesta y cuándo',
    'Extras opcionales que el cliente puede añadir al aceptar',
    'Catálogo de tus servicios con precio',
    'Panel con lo enviado, aceptado y pendiente',
    'Las 3 plantillas, tu color y tu logotipo',
    'Textos guardados e historial en «Mis propuestas»',
  ],
  business: [
    `Hasta ${PLAN_LIMITS.business} propuestas al mes (uso razonable)`,
    'Todo lo incluido en Pro',
  ],
}

/** Funciones previstas para Business que todavía no existen (se muestran como «En desarrollo»). */
export const BUSINESS_UPCOMING = ['Varias configuraciones de marca']

const ALL_TEMPLATES = ['classic', 'modern', 'minimal']

export function isPaidPlan(plan) {
  return plan === 'pro' || plan === 'business'
}

/**
 * @param {string} plan  'free' | 'pro' | 'business'
 * @param {boolean} paymentsEnabled  ¿se pueden comprar planes ahora mismo?
 */
export function getEntitlements(plan, paymentsEnabled) {
  // share: enviar por enlace y que el cliente acepte (siempre incluido, también gratis)
  if (!paymentsEnabled || isPaidPlan(plan)) {
    return {
      gated: false,
      templates: ALL_TEMPLATES,
      brand: true,
      snippets: true,
      history: true,
      share: true,
      viewTracking: true,
      extras: true,
      catalog: true,
      dashboard: true,
    }
  }
  return {
    gated: true,
    templates: [DEFAULT_TEMPLATE],
    brand: false,
    snippets: false,
    history: false,
    share: true,
    viewTracking: false,
    extras: false,
    catalog: false,
    dashboard: false,
  }
}

/**
 * Versión de la propuesta que se muestra y se descarga según el plan.
 * No modifica lo guardado: si el usuario mejora su plan, recupera su diseño.
 */
export function applyEntitlements(proposal, entitlements) {
  if (!entitlements.gated) return proposal
  const design = proposal.design
  const allowedTemplate = entitlements.templates.includes(design.template) ? design.template : DEFAULT_TEMPLATE
  const restricted = {
    template: allowedTemplate,
    accent: entitlements.brand ? design.accent : DEFAULT_ACCENT,
    logo: entitlements.brand ? design.logo : null,
  }
  const sameDesign =
    restricted.template === design.template && restricted.accent === design.accent && restricted.logo === design.logo
  const dropExtras = !entitlements.extras && (proposal.extras ?? []).length > 0
  if (sameDesign && !dropExtras) return proposal
  return {
    ...proposal,
    design: sameDesign ? design : restricted,
    ...(dropExtras ? { extras: [] } : {}),
  }
}
