// ─────────────────────────────────────────────────────────────────────────────
// Función de servidor (Supabase Edge Function): stripe-webhook
//
// Recibe los avisos de Stripe (pago completado, suscripción cambiada o cancelada) y
// actualiza el plan del usuario en la tabla subscriptions.
//
// Se pega en Supabase → Edge Functions → Via Editor, con el nombre: stripe-webhook
// ⚠️ En su configuración DESACTIVA la verificación JWT ("Verify JWT" / "Enforce JWT
//    verification"): Stripe no envía sesión de usuario. La seguridad la da la firma.
//
// Secretos necesarios:
//   STRIPE_WEBHOOK_SECRET  secreto de firma del webhook (whsec_...)
//   STRIPE_SECRET_KEY      clave secreta de Stripe
//   STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS  (para saber qué plan corresponde a cada precio)
//
// Seguridad: cada aviso se comprueba con la firma HMAC de Stripe. Sin firma válida, se rechaza.
// Así nadie puede activarse un plan enviando un aviso falso.
// ─────────────────────────────────────────────────────────────────────────────

type Env = (key: string) => string
type Deps = { env: Env; fetch: typeof fetch; now?: () => number }

const PAID_STATUSES = ['active', 'trialing', 'past_due']
const SIGNATURE_TOLERANCE_SECONDS = 300

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

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comparación en tiempo constante (evita ataques de tiempo). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Verifica la cabecera Stripe-Signature: t=<marca de tiempo>,v1=<firma HMAC-SHA256> */
export async function verifyStripeSignature(payload: string, header: string, secret: string, nowSeconds: number) {
  if (!header || !secret) return false
  const parts = header.split(',').map((p) => p.split('='))
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1])
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  return signatures.some((sig) => safeEqual(sig, expected))
}

export function createHandler(deps: Deps) {
  const { env } = deps
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000))
  const base = () => env('SUPABASE_URL')

  async function stripeGet(path: string) {
    const res = await deps.fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` },
    })
    const body = await res.json()
    if (!res.ok) throw new Error(`Stripe ${path}: ${body?.error?.message ?? res.status}`)
    return body
  }

  async function findRow(column: string, value: string) {
    const res = await deps.fetch(`${base()}/rest/v1/subscriptions?${column}=eq.${encodeURIComponent(value)}&select=*`, {
      headers: supabaseHeaders(env),
    })
    if (!res.ok) throw new Error(`Supabase subscriptions: ${res.status}`)
    return (await res.json())[0] ?? null
  }

  async function upsertRow(row: Record<string, unknown>) {
    const res = await deps.fetch(`${base()}/rest/v1/subscriptions?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...supabaseHeaders(env), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`Supabase guardar suscripción: ${res.status} ${await res.text()}`)
  }

  function planForPrice(priceId: string): 'pro' | 'business' | 'free' {
    if (priceId && priceId === env('STRIPE_PRICE_PRO')) return 'pro'
    if (priceId && priceId === env('STRIPE_PRICE_BUSINESS')) return 'business'
    return 'free'
  }

  /** Copia el estado de una suscripción de Stripe a la tabla subscriptions. */
  async function syncSubscription(sub: any, eventCreated: number, fallbackUserId?: string) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    let userId: string | undefined = sub.metadata?.user_id || fallbackUserId
    if (!userId && customerId) userId = (await findRow('stripe_customer_id', customerId))?.user_id
    if (!userId) {
      console.warn('Suscripción sin usuario asociado', sub.id)
      return 'unmatched'
    }

    const existing = await findRow('user_id', userId)
    const eventAt = new Date(eventCreated * 1000)

    if (existing && existing.stripe_subscription_id === sub.id && existing.last_event_at && new Date(existing.last_event_at) > eventAt) {
      return 'stale' // aviso antiguo que llega tarde: no se aplica
    }
    if (
      existing?.stripe_subscription_id &&
      existing.stripe_subscription_id !== sub.id &&
      PAID_STATUSES.includes(existing.status) &&
      !PAID_STATUSES.includes(sub.status)
    ) {
      return 'ignored_old_subscription' // el fin de una suscripción antigua no anula la actual
    }

    const item = sub.items?.data?.[0]
    // Desde la versión 2025-03-31 de la API, el fin de periodo está en cada elemento
    const periodEnd = item?.current_period_end ?? sub.current_period_end
    await upsertRow({
      user_id: userId,
      plan: planForPrice(item?.price?.id ?? ''),
      status: sub.status,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
      last_event_at: eventAt.toISOString(),
    })
    return 'updated'
  }

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

    const payload = await req.text()
    const valid = await verifyStripeSignature(payload, req.headers.get('Stripe-Signature') ?? '', env('STRIPE_WEBHOOK_SECRET'), now())
    if (!valid) return reply(400, { error: 'invalid_signature' })

    let event: any
    try {
      event = JSON.parse(payload)
    } catch {
      return reply(400, { error: 'invalid_payload' })
    }

    try {
      let result = 'ignored'
      const object = event.data?.object ?? {}
      switch (event.type) {
        case 'checkout.session.completed':
          if (object.mode === 'subscription' && object.subscription) {
            const subId = typeof object.subscription === 'string' ? object.subscription : object.subscription.id
            const sub = await stripeGet(`subscriptions/${encodeURIComponent(subId)}`)
            result = await syncSubscription(sub, event.created, object.client_reference_id ?? undefined)
          }
          break
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          result = await syncSubscription(object, event.created)
          break
        default:
          break
      }
      return reply(200, { received: true, result })
    } catch (error) {
      console.error(error)
      return reply(500, { error: 'processing_failed' }) // Stripe volverá a intentarlo
    }
  }
}

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void }
if (typeof Deno !== 'undefined') {
  Deno.serve(createHandler({ env: (key) => Deno.env.get(key) ?? '', fetch }))
}
