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

/** Error con un mensaje en español para mostrar al usuario. */
function friendly(error, userMessage) {
  const e = error instanceof Error ? error : new Error(error?.message ?? String(error))
  if (!e.userMessage) e.userMessage = userMessage
  return e
}

/** Comprueba la respuesta de Supabase ({ data, error }) y devuelve data. */
function unwrap({ data, error }, userMessage) {
  if (error) {
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
        ? 'Se han enviado demasiados enlaces. Espera unos minutos y vuelve a intentarlo.'
        : 'No se pudo enviar el enlace. Revisa el email y vuelve a intentarlo.',
    )
  }
}

export async function signOut() {
  const client = await getClient()
  unwrap(await client.auth.signOut(), 'No se pudo cerrar la sesión.')
}

// ─── Propuestas ──────────────────────────────────────────────────────────────

export async function listProposals() {
  const client = await getClient()
  const rows = unwrap(
    await client.from('proposals').select('id, title, client_name, updated_at').order('updated_at', { ascending: false }),
    'No se pudieron cargar tus propuestas.',
  )
  return (rows ?? []).map((r) => ({ id: r.id, title: r.title, clientName: r.client_name, updatedAt: r.updated_at }))
}

export async function fetchProposal(id) {
  const client = await getClient()
  const row = unwrap(await client.from('proposals').select('data').eq('id', id).maybeSingle(), 'No se pudo abrir la propuesta.')
  if (!row) throw friendly(new Error('not_found'), 'Esa propuesta ya no existe.')
  const proposal = normalizeProposal({ ...row.data, id })
  if (!proposal) throw friendly(new Error('invalid'), 'La propuesta guardada está dañada y no se puede abrir.')
  return proposal
}

export async function saveProposal(account, proposal) {
  const client = await getClient()
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
  const client = await getClient()
  unwrap(await client.from('proposals').delete().eq('id', id), 'No se pudo eliminar la propuesta.')
}

// ─── Perfil: tus datos, diseño y textos guardados ────────────────────────────

export async function fetchProfile() {
  const client = await getClient()
  const row = unwrap(
    await client.from('profiles').select('professional, design, snippets').maybeSingle(),
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
  }
}

/** Guarda solo las columnas indicadas: { professional?, design?, snippets? } */
export async function saveProfile(account, columns) {
  const client = await getClient()
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
  }
}

export async function fetchUsage(proposalId) {
  const client = await getClient()
  return toUsage(unwrap(await client.rpc('get_usage', { p_proposal_id: proposalId }), 'No se pudo consultar tu uso del mes.'))
}

/** Pide permiso al servidor para descargar. Devuelve { allowed, usage }. */
export async function registerExport(proposalId) {
  const client = await getClient()
  const data = unwrap(await client.rpc('register_export', { p_proposal_id: proposalId }), 'No se pudo comprobar tu límite mensual.')
  return { allowed: Boolean(data?.allowed), usage: toUsage(data) }
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

export async function deleteAccount() {
  const client = await getClient()
  unwrap(await client.rpc('delete_my_account'), 'No se pudo eliminar la cuenta. Inténtalo de nuevo.')
  await client.auth.signOut().catch(() => {})
}
