// Cuentas y guardado en la nube (Supabase).
// Todas las llamadas al servidor pasan por aquí, para que el resto de la app
// no dependa de los detalles de Supabase.
//
// Seguridad: el servidor (reglas RLS de supabase.sql) es quien decide qué puede
// leer o escribir cada usuario. Este archivo no confía en nada que no venga de él.

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js'
import { normalizeDesign, normalizeProposal } from './proposal.js'
import { loadCreateClient } from './supabaseLoader.js'

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let clientPromise = null

function getClient() {
  if (!cloudEnabled) return Promise.reject(new Error('Las cuentas no están configuradas.'))
  if (!clientPromise) {
    clientPromise = loadCreateClient()
      .then((createClient) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
      )
      .catch((error) => {
        clientPromise = null // permite reintentar si falló la descarga
        throw friendly(error, 'No se pudo conectar con el servidor de cuentas. Comprueba tu conexión.')
      })
  }
  return clientPromise
}

// ─── Sesión perdida ──────────────────────────────────────────────────────────
// Si el navegador pierde la sesión (por ejemplo, porque no guarda datos de la web), las
// peticiones llegarían al servidor sin identificar y fallarían. Se detecta antes de enviar
// nada y se avisa a la app para que pida entrar de nuevo, en vez de fallar en silencio.
const sessionLostListeners = new Set()

export function onSessionLost(callback) {
  sessionLostListeners.add(callback)
  return () => sessionLostListeners.delete(callback)
}

function sessionLost() {
  sessionLostListeners.forEach((cb) => cb())
  const e = new Error('no_session')
  e.noSession = true
  e.userMessage = 'Tu sesión se ha cerrado en este navegador. Vuelve a entrar con tu email.'
  return e
}

/** Cliente con la sesión del usuario comprobada (para leer o guardar sus datos). */
async function getUserClient() {
  const client = await getClient()
  const { data, error } = await client.auth.getSession()
  if (error || !data?.session?.access_token) throw sessionLost()
  return client
}

/** Error con un mensaje en español para mostrar al usuario. */
function friendly(error, userMessage) {
  const e = error instanceof Error ? error : new Error(error?.message ?? String(error))
  if (!e.userMessage) e.userMessage = userMessage
  return e
}

/** Comprueba la respuesta de Supabase ({ data, error }) y devuelve data. */
function unwrap({ data, error, status }, userMessage) {
  if (error) {
    // 401 / 42501: el servidor no reconoce la sesión
    if (status === 401 || error.code === '42501' || /JWT|permission denied/i.test(error.message ?? '')) throw sessionLost()
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    throw friendly(new Error(error.message || 'Error del servidor'), offline ? 'No hay conexión a internet.' : userMessage)
  }
  return data
}

function toAccount(session) {
  return session?.user ? { userId: session.user.id, email: session.user.email ?? '' } : null
}

// ─── Sesión ──────────────────────────────────────────────────────────────────

export async function getAccount() {
  const client = await getClient()
  const data = unwrap(await client.auth.getSession(), 'No se pudo comprobar tu sesión.')
  return toAccount(data?.session)
}

/** Avisa cuando se entra o se sale. Devuelve una función para dejar de escuchar. */
export async function onAccountChange(callback) {
  const client = await getClient()
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(toAccount(session)))
  return () => data?.subscription?.unsubscribe()
}

/** Envía un enlace de acceso al email (sin contraseña). */
export async function sendMagicLink(email) {
  const client = await getClient()
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } })
  if (error) {
    const rateLimited = error.status === 429 || /rate limit|too many/i.test(error.message ?? '')
    throw friendly(
      new Error(error.message),
      rateLimited
        ? 'Ahora mismo no se pueden enviar más enlaces por email. Espera un rato y vuelve a intentarlo, o entra con Google si está disponible.'
        : 'No se pudo enviar el enlace. Revisa el email y vuelve a intentarlo.',
    )
  }
}

/** Entrar con Google: lleva a la página de Google y vuelve a la app con la sesión iniciada. */
export async function signInWithGoogle() {
  const client = await getClient()
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  if (error) throw friendly(new Error(error.message), 'No se pudo abrir el acceso con Google. Inténtalo de nuevo o entra con tu email.')
}

export async function signOut() {
  const client = await getClient()
  unwrap(await client.auth.signOut(), 'No se pudo cerrar la sesión.')
}

// ─── Propuestas ──────────────────────────────────────────────────────────────

export async function listProposals() {
  const client = await getUserClient()
  const rows = unwrap(
    await client.from('proposals').select('id, title, client_name, updated_at').order('updated_at', { ascending: false }),
    'No se pudieron cargar tus propuestas.',
  )
  return (rows ?? []).map((r) => ({ id: r.id, title: r.title, clientName: r.client_name, updatedAt: r.updated_at }))
}

export async function fetchProposal(id) {
  const client = await getUserClient()
  const row = unwrap(await client.from('proposals').select('data').eq('id', id).maybeSingle(), 'No se pudo abrir la propuesta.')
  if (!row) throw friendly(new Error('not_found'), 'Esa propuesta ya no existe.')
  const proposal = normalizeProposal({ ...row.data, id })
  if (!proposal) throw friendly(new Error('invalid'), 'La propuesta guardada está dañada y no se puede abrir.')
  return proposal
}

export async function saveProposal(account, proposal) {
  const client = await getUserClient()
  unwrap(
    await client.from('proposals').upsert(
      {
        user_id: account.userId,
        id: proposal.id,
        title: (proposal.project?.title ?? '').slice(0, 200),
        client_name: (proposal.client?.name ?? '').slice(0, 200),
        data: proposal,
      },
      { onConflict: 'user_id,id' },
    ),
    'No se pudo guardar la propuesta en tu cuenta.',
  )
}

export async function deleteProposal(id) {
  const client = await getUserClient()
  unwrap(await client.from('proposals').delete().eq('id', id), 'No se pudo eliminar la propuesta.')
}

// ─── Perfil: tus datos, diseño y textos guardados ────────────────────────────

export async function fetchProfile() {
  const client = await getUserClient()
  const row = unwrap(
    await client.from('profiles').select('professional, design, snippets, catalog, pricing_settings').maybeSingle(),
    'No se pudieron cargar tus datos.',
  )
  if (!row) return null
  return {
    professional: {
      name: typeof row.professional?.name === 'string' ? row.professional.name : '',
      contact: typeof row.professional?.contact === 'string' ? row.professional.contact : '',
    },
    design: normalizeDesign(row.design),
    snippets: row.snippets && typeof row.snippets === 'object' ? row.snippets : {},
    catalog: Array.isArray(row.catalog) ? row.catalog : [],
    pricingSettings: row.pricing_settings && typeof row.pricing_settings === 'object' ? row.pricing_settings : {},
  }
}

/** Guarda solo las columnas indicadas: { professional?, design?, snippets?, catalog?, pricing_settings? } */
export async function saveProfile(account, columns) {
  const client = await getUserClient()
  unwrap(
    await client.from('profiles').upsert({ user_id: account.userId, ...columns }, { onConflict: 'user_id' }),
    'No se pudieron guardar tus datos en la cuenta.',
  )
}

// ─── Uso mensual (lo decide el servidor) ─────────────────────────────────────

function toUsage(data) {
  const used = Number(data?.used ?? 0)
  const limit = Number(data?.limit ?? 0)
  const alreadyCounted = Boolean(data?.already_counted)
  return {
    period: data?.period ?? '',
    used,
    limit,
    remaining: Math.max(0, limit - used),
    alreadyCounted,
    canExport: alreadyCounted || used < limit,
    // null = la respuesta no informa del plan (se conserva el que ya se conocía)
    plan: ['free', 'pro', 'business'].includes(data?.plan) ? data.plan : null,
    subscription: data?.subscription === undefined
      ? undefined
      : data.subscription
      ? {
          plan: data.subscription.plan,
          status: data.subscription.status,
          currentPeriodEnd: data.subscription.current_period_end,
          cancelAtPeriodEnd: Boolean(data.subscription.cancel_at_period_end),
        }
      : null,
  }
}

export async function fetchUsage(proposalId) {
  const client = await getUserClient()
  return toUsage(unwrap(await client.rpc('get_usage', { p_proposal_id: proposalId }), 'No se pudo consultar tu uso del mes.'))
}

/** Pide permiso al servidor para descargar. Devuelve { allowed, usage }. */
export async function registerExport(proposalId) {
  const client = await getUserClient()
  const data = unwrap(await client.rpc('register_export', { p_proposal_id: proposalId }), 'No se pudo comprobar tu límite mensual.')
  return { allowed: Boolean(data?.allowed), usage: toUsage(data) }
}

// ─── Propuestas compartidas por enlace ───────────────────────────────────────

const SHARE_COLUMNS =
  'token, proposal_id, title, client_name, status, revoked, shared_at, view_count, first_viewed_at, last_viewed_at, accepted_at, accepted_name, accepted_extras, accepted_total_cents'

function toShare(row) {
  if (!row) return null
  return {
    token: row.token,
    proposalId: row.proposal_id,
    title: row.title,
    clientName: row.client_name,
    status: row.status,
    revoked: Boolean(row.revoked),
    sharedAt: row.shared_at,
    viewCount: Number(row.view_count ?? 0),
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
    acceptedAt: row.accepted_at,
    acceptedName: row.accepted_name,
    acceptedExtras: Array.isArray(row.accepted_extras) ? row.accepted_extras : [],
    acceptedTotalCents: row.accepted_total_cents === null || row.accepted_total_cents === undefined ? null : Number(row.accepted_total_cents),
    snapshot: row.snapshot ?? null, // solo con getShare(id, { withSnapshot: true })
    pricing: row.pricing ?? null,
  }
}

/** Dirección pública que se envía al cliente. */
export function shareUrl(token) {
  const dir = window.location.pathname.replace(/[^/]*$/, '')
  return `${window.location.origin}${dir}ver.html?p=${token}`
}

/** Enlace de una propuesta (o null). Con withSnapshot, incluye la versión que ve el cliente. */
export async function getShare(proposalId, { withSnapshot = false } = {}) {
  const client = await getUserClient()
  const columns = withSnapshot ? `${SHARE_COLUMNS}, snapshot, pricing` : SHARE_COLUMNS
  const row = unwrap(
    await client.from('shared_proposals').select(columns).eq('proposal_id', proposalId).maybeSingle(),
    'No se pudo consultar el enlace de la propuesta.',
  )
  return toShare(row)
}

export async function listShares() {
  const client = await getUserClient()
  const rows = unwrap(
    await client.from('shared_proposals').select(SHARE_COLUMNS).order('shared_at', { ascending: false }),
    'No se pudieron cargar tus propuestas enviadas.',
  )
  return (rows ?? []).map(toShare)
}

/**
 * Crea el enlace o lo actualiza con la versión actual (si el cliente aún no la aceptó).
 * Requisito del servidor: la propuesta debe haber contado ya en el cupo (registerExport).
 */
export async function shareProposal(account, snapshot, pricing) {
  const client = await getUserClient()
  const fields = {
    title: (snapshot.project?.title ?? '').slice(0, 200),
    client_name: (snapshot.client?.name ?? '').slice(0, 200),
    snapshot,
    pricing,
  }
  const existing = await getShare(snapshot.id)
  if (existing?.status === 'accepted') return existing // lo aceptado no se cambia
  if (existing) {
    unwrap(
      await client.from('shared_proposals').update({ ...fields, revoked: false }).eq('proposal_id', snapshot.id),
      'No se pudo actualizar el enlace.',
    )
  } else {
    unwrap(
      await client.from('shared_proposals').insert({ user_id: account.userId, proposal_id: snapshot.id, ...fields }),
      'No se pudo crear el enlace.',
    )
  }
  return getShare(snapshot.id, { withSnapshot: true })
}

export async function setShareActive(proposalId, active) {
  const client = await getUserClient()
  unwrap(
    await client.from('shared_proposals').update({ revoked: !active }).eq('proposal_id', proposalId),
    active ? 'No se pudo activar el enlace.' : 'No se pudo desactivar el enlace.',
  )
  return getShare(proposalId, { withSnapshot: true })
}

// ─── Lado del cliente (sin cuenta): ver y aceptar una propuesta compartida ────

export async function viewSharedProposal(token) {
  const client = await getClient()
  const { data, error } = await client.rpc('view_shared_proposal', { p_token: token })
  if (error) throw friendly(new Error(error.message), 'No se pudo cargar la propuesta. Comprueba tu conexión y vuelve a intentarlo.')
  return data
}

/** version: fecha de envío (shared_at) de la versión que está viendo el cliente. */
export async function acceptSharedProposal(token, name, extraIds, version) {
  const client = await getClient()
  const { data, error } = await client.rpc('accept_shared_proposal', {
    p_token: token,
    p_name: name,
    p_extras: extraIds,
    p_version: version ?? null,
  })
  if (error) {
    const outdated = /outdated/.test(error.message ?? '')
    const message = /invalid_name/.test(error.message ?? '')
      ? 'Escribe tu nombre completo (al menos 2 letras).'
      : outdated
        ? 'Quien te la envió acaba de actualizar la propuesta. Vuelve a cargar la página para ver la versión nueva antes de aceptarla.'
        : /not_found/.test(error.message ?? '')
        ? 'Este enlace ya no está disponible.'
        : 'No se pudo aceptar la propuesta. Inténtalo de nuevo.'
    const e = friendly(new Error(error.message), message)
    e.outdated = outdated
    throw e
  }
  return data
}

// ─── Pagos (Stripe, a través de las funciones de servidor) ───────────────────

const PAYMENT_ERRORS = {
  not_configured: 'Los pagos todavía no están configurados en el servidor.',
  not_authenticated: 'Tu sesión ha caducado. Vuelve a entrar.',
  invalid_plan: 'Ese plan no está disponible.',
  no_customer: 'Todavía no tienes ninguna suscripción que gestionar.',
  payment_provider_error: 'No se pudo conectar con el sistema de pagos. Inténtalo de nuevo en unos minutos.',
}

async function invokePaymentFunction(name, body) {
  const client = await getClient()
  const { data, error } = await client.functions.invoke(name, { body })
  if (error) {
    let code = ''
    try {
      code = (await error.context?.json?.())?.error ?? ''
    } catch {
      // respuesta sin JSON
    }
    throw friendly(new Error(code || error.message), PAYMENT_ERRORS[code] ?? 'No se pudo abrir el sistema de pagos. Inténtalo de nuevo.')
  }
  if (!data?.url || !/^https:\/\//.test(data.url)) {
    throw friendly(new Error('invalid_url'), 'El sistema de pagos no devolvió una dirección válida.')
  }
  return data.url
}

/** Devuelve la dirección de la página de pago de Stripe para el plan elegido. */
export function startCheckout(plan) {
  return invokePaymentFunction('create-checkout', { plan })
}

/** Devuelve la dirección del portal de cliente (cambiar de plan, facturas, cancelar). */
export function openCustomerPortal() {
  return invokePaymentFunction('customer-portal', {})
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

export async function deleteAccount() {
  const client = await getClient()
  const { error } = await client.rpc('delete_my_account')
  if (error) {
    const active = /active_subscription/.test(error.message ?? '')
    throw friendly(
      new Error(error.message),
      active
        ? 'Antes de eliminar la cuenta, cancela tu suscripción en «Gestionar suscripción». Cuando quede programada la cancelación, podrás eliminarla.'
        : 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
    )
  }
  await client.auth.signOut().catch(() => {})
}
