// Lee la configuración de proposio-config.js (se edita sin volver a compilar).
// Si falta o no es válida, las cuentas quedan desactivadas y la app funciona sin ellas.

const runtime = (typeof window !== 'undefined' && window.PROPOSIO_CONFIG) || {}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** Detecta claves secretas pegadas por error (no deben estar nunca en una web). */
function isSecretKey(key) {
  if (key.startsWith('sb_secret_')) return true
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

function readConfig() {
  const url = clean(runtime.supabaseUrl).replace(/\/+$/, '')
  const key = clean(runtime.supabaseAnonKey)
  if (!url && !key) return { url: '', key: '', problem: null }
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) {
    return { url: '', key: '', problem: 'supabaseUrl no es válida: debe empezar por https:// (ej. https://abcd1234.supabase.co).' }
  }
  if (!key) return { url: '', key: '', problem: 'Falta supabaseAnonKey.' }
  if (isSecretKey(key)) {
    return {
      url: '',
      key: '',
      problem: 'Has pegado una clave SECRETA (service_role). Quítala de proposio-config.js y usa la clave pública "anon". Si ya la publicaste, regenérala en Supabase.',
    }
  }
  return { url, key, problem: null }
}

const config = readConfig()

if (config.problem && typeof console !== 'undefined') {
  console.error(`[proposio] Cuentas desactivadas: ${config.problem}`)
}

export const SUPABASE_URL = config.url
export const SUPABASE_ANON_KEY = config.key
export const CONFIG_PROBLEM = config.problem

// ─── Pagos ───────────────────────────────────────────────────────────────────
function readPayments() {
  const p = runtime.payments && typeof runtime.payments === 'object' ? runtime.payments : {}
  const plan = (raw, fallbackPrice) => ({
    price: clean(raw?.price) || fallbackPrice,
    period: clean(raw?.period) || 'al mes',
  })
  return {
    // Los pagos necesitan cuentas: sin Supabase configurado no se activan.
    enabled: p.enabled === true && Boolean(config.url && config.key),
    priceNote: clean(p.priceNote),
    pro: plan(p.pro, '7,90 €'),
    business: { ...plan(p.business, '14,90 €'), enabled: p.business?.enabled === true },
  }
}

export const PAYMENTS = readPayments()

// Entrar con Google: solo se muestra si está activado aquí Y configurado en Supabase
// (Authentication → Sign In / Providers → Google). Ver CONFIGURAR-CUENTAS.md.
export const GOOGLE_LOGIN = runtime.googleLogin === true && Boolean(config.url && config.key)
