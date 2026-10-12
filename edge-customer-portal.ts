// ─────────────────────────────────────────────────────────────────────────────
// Función de servidor (Supabase Edge Function): customer-portal
//
// Abre el portal de cliente de Stripe, donde el usuario puede cambiar de plan,
// actualizar su tarjeta, descargar facturas y cancelar la suscripción.
// Se pega en Supabase → Edge Functions → Via Editor, con el nombre: customer-portal
// (deja activada la verificación JWT). Usa los mismos secretos que create-checkout.
// ─────────────────────────────────────────────────────────────────────────────

type Env = (key: string) => string
type Deps = { env: Env; fetch: typeof fetch }

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
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`
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

async function getUser(deps: Deps, req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const res = await deps.fetch(`${deps.env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: serviceKey(deps.env), Authorization: auth },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id ? { id: user.id } : null
}

export function createHandler(deps: Deps) {
  const { env } = deps
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(env) })
    if (req.method !== 'POST') return json(env, 405, { error: 'method_not_allowed' })
    if (!/^https:\/\//.test(env('APP_URL')) || !env('STRIPE_SECRET_KEY')) return json(env, 500, { error: 'not_configured' })

    const user = await getUser(deps, req)
    if (!user) return json(env, 401, { error: 'not_authenticated' })

    try {
      const res = await deps.fetch(
        `${env('SUPABASE_URL')}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`,
        { headers: supabaseHeaders(env) },
      )
      if (!res.ok) throw new Error(`Supabase subscriptions: ${res.status}`)
      const customer = (await res.json())[0]?.stripe_customer_id
      if (!customer) return json(env, 400, { error: 'no_customer' })

      const portalRes = await deps.fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `customer=${encodeURIComponent(customer)}&return_url=${encodeURIComponent(env('APP_URL'))}`,
      })
      const portal = await portalRes.json()
      if (!portalRes.ok) throw new Error(`Stripe portal: ${portal?.error?.message ?? portalRes.status}`)
      return json(env, 200, { url: portal.url })
    } catch (error) {
      console.error(error)
      return json(env, 502, { error: 'payment_provider_error' })
    }
  }
}

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void }
if (typeof Deno !== 'undefined') {
  Deno.serve(createHandler({ env: (key) => Deno.env.get(key) ?? '', fetch }))
}
