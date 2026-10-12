// ─────────────────────────────────────────────────────────────────────────────
// Función de servidor (Supabase Edge Function): notify-acceptance
//
// Envía un email al profesional cuando su cliente acepta una propuesta enviada por enlace.
// La llama la base de datos (disparador en supabase.sql) justo después de la aceptación.
//
// Seguridad: no necesita sesión («Verify JWT» desactivado). Solo actúa si recibe el código
// secreto de un enlace que YA está aceptado y que aún no se ha avisado; marca el aviso en la
// base de datos antes de enviar, así que cada aceptación genera como mucho un email.
//
// Envío: por SMTP (por ejemplo, una cuenta de Gmail con «contraseña de aplicación»).
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   SMTP_USER   la dirección de email (obligatorio)
//   SMTP_PASS   la contraseña de aplicación, no la contraseña normal (obligatorio)
//   SMTP_HOST   opcional; por defecto smtp.gmail.com
//   SMTP_PORT   opcional; por defecto 465 (SSL). Las funciones de Supabase no permiten 25 ni 587.
//   SMTP_FROM   opcional; por defecto "proposio <SMTP_USER>"
//   APP_URL     opcional; dirección de la app para el botón del email
// Mientras falten SMTP_USER o SMTP_PASS, la función no envía nada (responde «not_configured»).
// ─────────────────────────────────────────────────────────────────────────────

type Env = (key: string) => string
type Mail = { from: string; to: string; subject: string; text: string; html: string }
type Deps = { env: Env; fetch: typeof fetch; sendMail?: (env: Env, mail: Mail) => Promise<void> }

const TOKEN_RE = /^[0-9a-f]{32}$/

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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${euros},${String(abs % 100).padStart(2, '0')} €`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Asunto y cuerpo del email (texto y HTML sencillo, sin imágenes externas). */
export function buildMail(row: Record<string, any>, to: string, from: string, appUrl: string): Mail {
  const who = String(row.accepted_name ?? 'Tu cliente').slice(0, 120)
  const title = String(row.title || 'tu propuesta').slice(0, 200)
  const client = String(row.client_name ?? '').slice(0, 200)
  const extras: Array<{ concept: string; cents: number }> = Array.isArray(row.accepted_extras) ? row.accepted_extras : []
  const total = Number.isInteger(row.accepted_total_cents) ? formatCents(row.accepted_total_cents) : ''
  const lines = [
    `${who}${client ? ` (${client})` : ''} ha aceptado «${title}».`,
    total ? `Total aceptado: ${total}` : '',
    extras.length ? `Extras elegidos: ${extras.map((e) => `${e.concept} (+${formatCents(e.cents)})`).join(', ')}` : '',
    '',
    appUrl
      ? `Abre proposio para ver los detalles y descargar el justificante de aceptación: ${appUrl}`
      : 'Abre proposio para ver los detalles y descargar el justificante de aceptación.',
    '',
    'Recibes este email porque enviaste esta propuesta con proposio.',
  ].filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '')
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#17212f;max-width:560px">
<p style="font-size:18px;font-weight:700;color:#127a4b;margin:0 0 12px">🎉 Propuesta aceptada</p>
<p style="margin:0 0 12px"><strong>${esc(who)}</strong>${client ? ` (${esc(client)})` : ''} ha aceptado <strong>«${esc(title)}»</strong>.</p>
${total ? `<p style="margin:0 0 8px">Total aceptado: <strong>${esc(total)}</strong></p>` : ''}
${extras.length ? `<p style="margin:0 0 8px">Extras elegidos: ${extras.map((e) => `${esc(e.concept)} (+${esc(formatCents(e.cents))})`).join(', ')}</p>` : ''}
${appUrl ? `<p style="margin:16px 0"><a href="${esc(appUrl)}" style="display:inline-block;background:#20375a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">Abrir proposio</a></p>` : ''}
<p style="margin:0;color:#637084;font-size:13px">Desde la propuesta puedes descargar el justificante de aceptación. Recibes este email porque enviaste esta propuesta con proposio.</p>
</div>`
  return { from, to, subject: `🎉 ${who} ha aceptado «${title}»`, text: lines.join('\n'), html }
}

/** Envío real por SMTP (SSL, puerto 465). */
async function smtpSend(env: Env, mail: Mail): Promise<void> {
  // @ts-ignore: importación de npm en el entorno Deno de Supabase
  const nodemailer = (await import('npm:nodemailer@6.9.16')).default
  const transport = nodemailer.createTransport({
    host: env('SMTP_HOST') || 'smtp.gmail.com',
    port: Number(env('SMTP_PORT') || 465),
    secure: true,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  })
  await transport.sendMail(mail)
}

export function createHandler({ env, fetch: fetchFn, sendMail = smtpSend }: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
    let token = ''
    try {
      token = String((await req.json())?.token ?? '')
    } catch {
      return json(400, { error: 'invalid_body' })
    }
    if (!TOKEN_RE.test(token)) return json(400, { error: 'invalid_token' })

    const configured = ['SMTP_USER', 'SMTP_PASS'].every((k) => env(k))
    if (!configured) return json(200, { skipped: 'not_configured' })

    const base = env('SUPABASE_URL').replace(/\/+$/, '')
    const key = serviceKey(env)
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

    // Marca el aviso (solo si está aceptada y no avisada): garantiza un único email por aceptación
    const claim = await fetchFn(
      `${base}/rest/v1/shared_proposals?token=eq.${token}&status=eq.accepted&accepted_notified_at=is.null` +
        '&select=user_id,title,client_name,accepted_name,accepted_total_cents,accepted_extras',
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ accepted_notified_at: new Date().toISOString() }),
      },
    )
    if (!claim.ok) return json(502, { error: 'database_error' })
    const rows = await claim.json()
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row) return json(200, { skipped: 'nothing_to_notify' })

    const userRes = await fetchFn(`${base}/auth/v1/admin/users/${row.user_id}`, { headers })
    const user = userRes.ok ? await userRes.json() : null
    const to = typeof user?.email === 'string' ? user.email : ''
    if (!to) return json(200, { skipped: 'no_email' })

    const from = env('SMTP_FROM') || `proposio <${env('SMTP_USER')}>`
    try {
      await sendMail(env, buildMail(row, to, from, env('APP_URL')))
    } catch (err) {
      // Se libera la marca para poder reintentar
      await fetchFn(`${base}/rest/v1/shared_proposals?token=eq.${token}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ accepted_notified_at: null }),
      }).catch(() => {})
      console.error('notify-acceptance: envío fallido', err instanceof Error ? err.message : err)
      return json(502, { error: 'send_failed' })
    }
    return json(200, { sent: true })
  }
}

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void }
if (typeof Deno !== 'undefined') {
  Deno.serve(createHandler({ env: (key) => Deno.env.get(key) ?? '', fetch }))
}
