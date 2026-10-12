// ─────────────────────────────────────────────────────────────────────────────
// Función de servidor (Supabase Edge Function): create-checkout
//
// Crea una página de pago de Stripe para suscribirse a Pro o Business.
// Se pega tal cual en Supabase → Edge Functions → "Deploy a new function" → Via Editor,
// con el nombre: create-checkout   (deja activada la verificación JWT)
//
// Secretos necesarios (Edge Functions → Secrets):
//   STRIPE_SECRET_KEY     clave secreta de Stripe (sk_test_... para pruebas, sk_live_... real)
//   STRIPE_PRICE_PRO      id del precio mensual de Pro      (price_...)
//   STRIPE_PRICE_BUSINESS id del precio mensual de Business (price_...) — opcional
//   APP_URL               dirección de la app, p. ej. https://usuario.github.io/proposio/app.html
// Supabase añade solo SUPABASE_URL y la clave de servicio.
//
// Seguridad: el usuario se identifica con su sesión (no con datos que envíe la web), y el
// precio sale de los secretos del servidor, nunca del navegador.
// ─────────────────────────────────────────────────────────────────────────────

type Env = (key: string) => string
type Deps = { env: Env; fetch: typeof fetch }

const PAID_STATUSES = ['active', 'trialing', 'past_due']

function serviceKey(env: Env): string {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}')
    const first = Object.values(keys)[0]
    return typeof first === 'string' ? first : ''
  } catch {
    return ''
  }
}

function supabaseHeaders(env: Env): Record<string, string> {
  const key = serviceKey(env)
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}` // clave antigua en formato JWT
  return headers
}

function cors(env: Env): Record<string, string> {
  let origin = '*'
  try {
    origin = new URL(env('APP_URL')).origin
  } catch {
    // sin APP_URL válida se responde con error más abajo
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(env: Env, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(env), 'Content-Type': 'application/json' } })
}

/** Usuario de la sesión, comprobado por Supabase a partir del token del navegador. */
async function getUser(deps: Deps, req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const res = await deps.fetch(`${deps.env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: serviceKey(deps.env), Authorization: auth },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id ? { id: user.id, email: user.email ?? '' } : null
}

/** Codifica parámetros anidados como los espera la API de Stripe: a[b][0][c]=valor */
function formEncode(data: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (typeof value === 'object') out.push(...formEncode(value as Record<string, unknown>, name))
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
  }
  return out
}

async function stripe(deps: Deps, path: string, params: Record<string, unknown>) {
  const res = await deps.fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.env('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode(params).join('&'),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Stripe ${path}: ${body?.error?.message ?? res.status}`)
  return body
}

async function getSubscriptionRow(deps: Deps, userId: string) {
  const res = await deps.fetch(
    `${deps.env('SUPABASE_URL')}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`,
    { headers: supabaseHeaders(deps.env) },
  )
  if (!res.ok) throw new Error(`Supabase subscriptions: ${res.status}`)
  const rows = await res.json()
  return rows[0] ?? null
}

async function saveCustomer(deps: Deps, userId: string, customerId: string) {
  const res = await deps.fetch(`${deps.env('SUPABASE_URL')}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...supabaseHeaders(deps.env), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, stripe_customer_id: customerId }),
  })
  if (!res.ok) throw new Error(`Supabase guardar cliente: ${res.status}`)
}

export function createHandler(deps: Deps) {
  const { env } = deps
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(env) })
    if (req.method !== 'POST') return json(env, 405, { error: 'method_not_allowed' })

    const appUrl = env('APP_URL')
    if (!/^https:\/\//.test(appUrl) || !env('STRIPE_SECRET_KEY')) {
      return json(env, 500, { error: 'not_configured' })
    }

    const user = await getUser(deps, req)
    if (!user) return json(env, 401, { error: 'not_authenticated' })

    let plan = ''
    try {
      plan = (await req.json())?.plan ?? ''
    } catch {
      return json(env, 400, { error: 'invalid_body' })
    }
    const price = plan === 'pro' ? env('STRIPE_PRICE_PRO') : plan === 'business' ? env('STRIPE_PRICE_BUSINESS') : ''
    if (!price) return json(env, 400, { error: 'invalid_plan' })

    try {
      const row = await getSubscriptionRow(deps, user.id)

      // Ya tiene un plan de pago: se gestiona desde el portal (cambiar o cancelar), sin duplicar suscripciones
      if (row && row.plan !== 'free' && PAID_STATUSES.includes(row.status) && row.stripe_customer_id) {
        const portal = await stripe(deps, 'billing_portal/sessions', { customer: row.stripe_customer_id, return_url: appUrl })
        return json(env, 200, { url: portal.url, portal: true })
      }

      let customer = row?.stripe_customer_id
      if (!customer) {
        const created = await stripe(deps, 'customers', { email: user.email, metadata: { user_id: user.id } })
        customer = created.id
        await saveCustomer(deps, user.id, customer)
      }

      const session = await stripe(deps, 'checkout/sessions', {
        mode: 'subscription',
        customer,
        client_reference_id: user.id,
        line_items: [{ price, quantity: 1 }],
        success_url: `${appUrl}?pago=ok`,
        cancel_url: `${appUrl}?pago=cancelado`,
        locale: 'es',
        metadata: { user_id: user.id, plan },
        subscription_data: { metadata: { user_id: user.id, plan } },
      })
      return json(env, 200, { url: session.url })
    } catch (error) {
      console.error(error)
      return json(env, 502, { error: 'payment_provider_error' })
    }
  }
}

// En Supabase (Deno) se arranca el servidor; en las pruebas solo se importa createHandler.
declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void }
if (typeof Deno !== 'undefined') {
  Deno.serve(createHandler({ env: (key) => Deno.env.get(key) ?? '', fetch }))
}
