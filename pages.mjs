// Genera las páginas «Plantilla de presupuesto para…» de cada profesión (una por archivo .html).
// Sirven para que quien busque en Google «presupuesto para fotógrafo» llegue a proposio.
// Los ejemplos salen de samples.js, así que coinciden con lo que se carga en la app.
//
// Uso (desde esta carpeta):  node pages.mjs   (también lo ejecuta «npm run build»)

import { writeFileSync } from 'node:fs'
import { computeTotals } from './pricing.js'
import { formatCents, parseAmountToCents } from './format.js'
import { SAMPLE_PROFESSIONS, createProfessionSample } from './samples.js'

// Dirección pública de la web (cámbiala si usas otro dominio y vuelve a generar)
export const SITE_URL = 'https://p9nkm76vgk-ops.github.io/Proposio-fase-3/'

/** Contenido propio de cada profesión. Sin cifras ni datos inventados: solo consejos prácticos. */
export const PAGES = [
  {
    id: 'web',
    file: 'presupuesto-diseno-web.html',
    who: 'diseñadores y desarrolladores web',
    short: 'Diseño web',
    title: 'Plantilla de presupuesto de diseño web (gratis)',
    lead: 'Prepara el presupuesto de una página web con el desglose por fases, lo que incluye y lo que no, y envíaselo a tu cliente para que lo acepte con un botón.',
    include: [
      ['Páginas y funciones', 'Cuántas páginas, qué secciones y qué funciones (formulario, catálogo, reservas…). Evita el «web completa» sin detalle.'],
      ['Contenidos', 'Quién aporta textos, fotos y logotipo, y qué pasa si no llegan a tiempo.'],
      ['Revisiones', 'Cuántas rondas de cambios entran en el precio, sobre el diseño y sobre la web terminada.'],
      ['Dominio y alojamiento', 'Si los contrata el cliente a su nombre o tú, y si su coste está incluido.'],
      ['Plazos por fases', 'Diseño, desarrollo y publicación, y desde cuándo empiezan a contar.'],
      ['Mantenimiento', 'Si está excluido, dilo. Si lo ofreces, añádelo como extra opcional.'],
    ],
    mistakes: [
      'No aclarar si el precio lleva IVA. En proposio eliges siempre si los impuestos están incluidos, no incluidos o sin especificar.',
      'Dejar abiertos los cambios ilimitados. Pon un número de revisiones.',
      'Olvidar las exclusiones: textos, fotografía, pasarela de pago, mantenimiento.',
    ],
  },
  {
    id: 'photo',
    file: 'presupuesto-fotografia.html',
    who: 'fotógrafos',
    short: 'Fotografía',
    title: 'Plantilla de presupuesto de fotografía (gratis)',
    lead: 'Crea el presupuesto de una sesión o un reportaje con horas, número de fotos editadas y plazos de entrega, y ofrece extras como fotos adicionales o entrega urgente.',
    include: [
      ['Tipo de sesión', 'Producto, evento, retrato, ambiente… y dónde se hace (estudio, exteriores, local del cliente).'],
      ['Duración y número de fotos', 'Horas de sesión y cuántas fotografías editadas se entregan, con sus formatos.'],
      ['Edición', 'Qué retoque incluye y qué se considera retoque avanzado.'],
      ['Entrega', 'Plazo y forma de entrega (galería online, descarga, soporte físico).'],
      ['Derechos de uso', 'Para qué puede usar el cliente las fotos (web, redes, publicidad impresa).'],
      ['Desplazamientos y atrezo', 'Si están incluidos o se cobran aparte.'],
    ],
    mistakes: [
      'No fijar cuántas fotos editadas se entregan.',
      'No hablar de los derechos de uso de las imágenes.',
      'Cobrar la reserva sin dejarlo por escrito: indica el pago para reservar fecha en las condiciones.',
    ],
  },
  {
    id: 'dev',
    file: 'presupuesto-desarrollo-software.html',
    who: 'desarrolladores de software y aplicaciones',
    short: 'Desarrollo de software',
    title: 'Plantilla de presupuesto de desarrollo de software (gratis)',
    lead: 'Presupuesta una aplicación o un desarrollo a medida con fases, horas estimadas, entregables y condiciones de pago por hitos.',
    include: [
      ['Alcance', 'Qué funciones entran en esta versión y cuáles quedan para más adelante.'],
      ['Fases e hitos', 'Análisis, prototipo, desarrollo, pruebas y puesta en marcha, con un pago asociado a cada hito si lo prefieres.'],
      ['Horas estimadas', 'Si cobras por horas, indica la estimación y qué pasa si se supera.'],
      ['Entregables', 'Código fuente, documentación, formación y en qué servidor queda publicado.'],
      ['Cambios de alcance', 'Cómo se presupuestan las peticiones nuevas.'],
      ['Soporte', 'Si hay un periodo de garantía o un mantenimiento opcional.'],
    ],
    mistakes: [
      'Prometer funciones sin definir: lista lo que entra y lo que no.',
      'No separar los costes de terceros (servidores, servicios externos).',
      'Cobrar todo al final: reparte los pagos por hitos.',
    ],
  },
  {
    id: 'consulting',
    file: 'presupuesto-consultoria.html',
    who: 'consultores',
    short: 'Consultoría',
    title: 'Plantilla de propuesta de consultoría (gratis)',
    lead: 'Redacta una propuesta de consultoría clara: el problema del cliente, cómo lo vas a abordar, qué entregas y cuánto cuesta cada fase.',
    include: [
      ['Necesidad del cliente', 'Explica con sus palabras qué quiere resolver: es lo primero que lee.'],
      ['Metodología', 'Cómo vas a trabajar: entrevistas, visitas, análisis de datos, talleres.'],
      ['Entregables', 'Informes, planes de acción, sesiones de seguimiento.'],
      ['Jornadas u horas', 'Cuántas jornadas presenciales o en remoto incluye el precio.'],
      ['Información necesaria', 'Qué datos o accesos necesitas del cliente para empezar.'],
      ['Gastos', 'Si los desplazamientos están incluidos o se facturan aparte.'],
    ],
    mistakes: [
      'Hablar más de ti que del problema del cliente.',
      'No concretar los entregables: «asesoramiento» no se puede comprobar.',
      'No poner validez a la oferta: indica hasta cuándo es válida.',
    ],
  },
  {
    id: 'marketing',
    file: 'presupuesto-marketing-redes-sociales.html',
    who: 'profesionales del marketing y las redes sociales',
    short: 'Marketing y redes sociales',
    title: 'Plantilla de presupuesto de gestión de redes sociales (gratis)',
    lead: 'Presupuesta la gestión mensual de redes sociales con publicaciones, informes y condiciones claras, y ofrece extras como sesiones de fotos o campañas de anuncios.',
    include: [
      ['Redes incluidas', 'En qué redes vas a publicar y cuáles no.'],
      ['Volumen mensual', 'Número de publicaciones, historias o vídeos al mes.'],
      ['Atención a la comunidad', 'Si respondes mensajes y comentarios, y en qué horario.'],
      ['Informes', 'Cada cuánto envías resultados y qué incluyen.'],
      ['Inversión en anuncios', 'Deja claro que el presupuesto de anuncios se paga aparte a la plataforma.'],
      ['Duración y permanencia', 'Meses de servicio y cómo se cancela.'],
    ],
    mistakes: [
      'Mezclar tu tarifa con la inversión en anuncios.',
      'No fijar el número de publicaciones al mes.',
      'No decir quién aporta las fotos y los vídeos.',
    ],
  },
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ICON =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2214%22%20fill%3D%22%23fff%22/%3E%3Cg%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M29%207%20L12.5%2023.5%20Q9%2027%2012.5%2030.5%20L19.5%2037.5%22%20stroke%3D%22%2320375A%22%20stroke-width%3D%226.5%22/%3E%3Cpath%20d%3D%22M35%2013%20L51.5%2029.5%20Q55%2033%2051.5%2036.5%20L37%2051%22%20stroke%3D%22%234A90BA%22%20stroke-width%3D%226.5%22/%3E%3Cpath%20d%3D%22M13%2054%20L39%2028%22%20stroke%3D%22%23fff%22%20stroke-width%3D%2212%22/%3E%3Cpath%20d%3D%22M13%2054%20L39%2028%22%20stroke%3D%22%2320375A%22%20stroke-width%3D%226.5%22/%3E%3C/g%3E%3Cpath%20d%3D%22M30%2022%20H45%20V37%20Z%22%20fill%3D%22%2320375A%22%20stroke%3D%22%23fff%22%20stroke-width%3D%223%22%20stroke-linejoin%3D%22round%22%20paint-order%3D%22stroke%22/%3E%3C/svg%3E'

const CSS = `
:root{--navy:#20375a;--navy-deep:#162843;--blue:#4a90ba;--ground:#eef2f6;--paper:#fff;--ink:#17212f;--text:#3a4554;--muted:#637084;--line:#d6dee7;
--serif:Charter,'Bitstream Charter','Iowan Old Style','Palatino Linotype',Georgia,serif;--sans:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);font:17px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--navy)}
:focus-visible{outline:3px solid rgb(74 144 186/60%);outline-offset:3px}
.wrap{width:min(1040px,100%);margin:0 auto;padding-inline:24px}
.top{padding-block:18px}.top .wrap{display:flex;align-items:center;gap:12px}
.brand{display:flex;align-items:center;gap:10px;margin-right:auto;color:var(--ink);font-weight:750;font-size:21px;letter-spacing:-.02em;text-decoration:none}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:8px;border:1px solid transparent;font-weight:650;font-size:16px;text-decoration:none;white-space:nowrap}
.button--primary{background:var(--navy);color:#fff}.button--primary:hover{background:var(--navy-deep)}
.button--plain{border-color:var(--line);background:var(--paper);color:var(--ink)}
.top .button{min-height:40px;padding:0 16px;font-size:15px}
.crumbs{font-size:14px;color:var(--muted);margin:8px 0 0}.crumbs a{color:var(--muted)}
h1{font:600 clamp(32px,5vw,48px)/1.1 var(--serif);color:var(--ink);letter-spacing:-.01em;margin:10px 0 16px}
h2{font:600 28px/1.2 var(--serif);color:var(--ink);margin:0 0 18px}
.lead{font-size:19px;max-width:44em;margin:0 0 24px}
.hero{padding-block:24px 48px}
.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.small{font-size:14px;color:var(--muted)}
section.block{padding-block:56px;border-top:1px solid var(--line)}
section.block--paper{background:var(--paper)}
.include{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 48px;margin:0}
.include div{padding-left:16px;border-left:3px solid var(--blue)}
.include dt{font-weight:650;color:var(--ink)}.include dd{margin:4px 0 0}
.sheet{background:var(--paper);border:1px solid var(--line);border-radius:6px;box-shadow:0 18px 48px rgb(17 30 48/10%);padding:32px;max-width:760px}
.sheet__kicker{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--navy);margin:0}
.sheet__title{font:600 24px/1.2 var(--serif);color:var(--ink);margin:6px 0 18px}
table{width:100%;border-collapse:collapse;font-size:15px}
th{font-size:12px;letter-spacing:.06em;color:var(--muted);text-align:left;border-bottom:1px solid var(--line);padding:8px 6px}
td{padding:9px 6px;border-bottom:1px solid var(--line)}.num{text-align:right;white-space:nowrap}
.totals{margin:12px 0 0 auto;width:min(320px,100%);font-size:15px}
.totals div{display:flex;justify-content:space-between;padding:3px 0}.totals .total{font-weight:700;color:var(--ink);border-top:1px solid var(--ink);margin-top:6px;padding-top:8px}
.extras{margin-top:18px;font-size:15px}.note{font-size:13px;color:var(--muted);margin:8px 0 0}
ul.tips{padding-left:20px;margin:0}ul.tips li{margin-bottom:10px}
.others{display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;margin:0}
details{border-bottom:1px solid var(--line);padding:14px 0}summary{font-weight:650;color:var(--ink);cursor:pointer}
footer{padding-block:28px;font-size:14px;color:var(--muted)}footer .wrap{display:flex;gap:18px;flex-wrap:wrap}footer a{color:var(--muted)}
@media (max-width:640px){.wrap{padding-inline:16px}.include{grid-template-columns:1fr}.sheet{padding:20px}.hide-xs{display:none}.top .button{padding:0 12px;font-size:14px}.actions .button{width:100%}}
`

const MARK = `<svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M29 7 L12.5 23.5 Q9 27 12.5 30.5 L19.5 37.5" stroke="#20375A" stroke-width="6.5"/><path d="M35 13 L51.5 29.5 Q55 33 51.5 36.5 L37 51" stroke="#4A90BA" stroke-width="6.5"/><path d="M13 54 L39 28" stroke="#EEF2F6" stroke-width="12"/><path d="M13 54 L39 28" stroke="#20375A" stroke-width="6.5"/></g><path d="M30 22 H45 V37 Z" fill="#20375A" stroke="#EEF2F6" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/></svg>`

function sampleTable(sample) {
  const t = computeTotals(sample)
  const rows = t.lines
    .map((l) => `<tr><td>${esc(l.concept)}</td><td class="num">${esc(String(l.quantity).replace('.', ','))}</td><td class="num">${formatCents(l.cents)}</td></tr>`)
    .join('')
  const tax =
    t.taxRate !== null
      ? `<div><span>Base</span><span>${formatCents(t.base)}</span></div><div><span>${esc(sample.tax.label)} (${String(t.taxRate).replace('.', ',')} %)</span><span>${formatCents(t.taxAmount)}</span></div>`
      : ''
  const extras = (sample.extras ?? [])
    .map((e) => `<li>${esc(e.concept)}: +${formatCents(parseAmountToCents(e.price))}</li>`)
    .join('')
  return `<table><thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Importe</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">${tax}<div class="total"><span>Total</span><span>${formatCents(t.total)}</span></div></div>
${extras ? `<div class="extras"><strong>Extras opcionales</strong> (el cliente puede añadirlos al aceptar):<ul>${extras}</ul></div>` : ''}
<p class="note">Datos e importes de ejemplo, inventados. Pon siempre los tuyos.</p>`
}

function page(p) {
  const sample = createProfessionSample(p.id)
  const url = `${SITE_URL}${p.file}`
  const appUrl = `app.html?ejemplo=${p.id}`
  const others = PAGES.filter((o) => o.id !== p.id)
    .map((o) => `<li><a class="button button--plain" href="${o.file}">${esc(o.short)}</a></li>`)
    .join('')
  const description = `${p.lead} Plantilla gratuita para ${p.who}: edítala, descárgala en PDF o envíala por enlace.`.slice(0, 300)
  return `<!doctype html>
<html lang="es">
  <head>
    <!-- ARCHIVO GENERADO con "node pages.mjs" (o "npm run build"). Para cambiar el texto, edita pages.mjs. -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(p.title)} · proposio</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#20375a" />
    <meta property="og:title" content="${esc(p.title)}" />
    <meta property="og:description" content="${esc(p.lead)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:url" content="${url}" />
    <link rel="icon" type="image/svg+xml" href="${ICON}" />
    <style>${CSS}</style>
  </head>
  <body>
    <header class="top">
      <div class="wrap">
        <a class="brand" href="./" aria-label="proposio, inicio">${MARK}<span>proposio</span></a>
        <a class="button button--primary" href="${appUrl}">Usar<span class="hide-xs">&nbsp;esta plantilla</span></a>
      </div>
    </header>
    <main>
      <section class="hero">
        <div class="wrap">
          <p class="crumbs"><a href="./">Inicio</a> › Plantillas › ${esc(p.short)}</p>
          <h1>${esc(p.title)}</h1>
          <p class="lead">${esc(p.lead)}</p>
          <div class="actions">
            <a class="button button--primary" href="${appUrl}">Abrir esta plantilla gratis</a>
            <a class="button button--plain" href="#ejemplo">Ver el ejemplo</a>
          </div>
          <p class="small">Sin registrarte. Cambia los datos de ejemplo por los tuyos y descárgala en PDF.</p>
        </div>
      </section>

      <section class="block block--paper" id="que-incluir">
        <div class="wrap">
          <h2>Qué debe incluir un presupuesto para ${esc(p.who)}</h2>
          <dl class="include">
            ${p.include.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('\n            ')}
          </dl>
        </div>
      </section>

      <section class="block" id="ejemplo">
        <div class="wrap">
          <h2>Ejemplo de presupuesto</h2>
          <div class="sheet">
            <p class="sheet__kicker">PROPUESTA COMERCIAL</p>
            <p class="sheet__title">${esc(sample.project.title)}</p>
            ${sampleTable(sample)}
          </div>
          <div class="actions" style="margin-top:24px">
            <a class="button button--primary" href="${appUrl}">Editar este ejemplo</a>
          </div>
        </div>
      </section>

      <section class="block block--paper">
        <div class="wrap">
          <h2>Errores frecuentes que conviene evitar</h2>
          <ul class="tips">
            ${p.mistakes.map((m) => `<li>${esc(m)}</li>`).join('\n            ')}
          </ul>
        </div>
      </section>

      <section class="block">
        <div class="wrap">
          <h2>Preguntas frecuentes</h2>
          <details>
            <summary>¿Es gratis?</summary>
            <p>Sí. Puedes crear, editar y descargar propuestas en PDF gratis, sin registrarte.</p>
          </details>
          <details>
            <summary>¿Puede mi cliente aceptarlo online?</summary>
            <p>Sí, si entras con una cuenta gratuita: le envías un enlace por WhatsApp o email, lo ve en el móvil y lo acepta escribiendo su nombre. Te avisamos al entrar en la app.</p>
          </details>
          <details>
            <summary>¿proposio pone los precios por mí?</summary>
            <p>No. Los importes, impuestos y condiciones los decides tú. proposio los ordena y calcula los totales, y te ayuda a calcular tu precio mínimo por hora con tus propios datos.</p>
          </details>
        </div>
      </section>

      <section class="block block--paper">
        <div class="wrap">
          <h2>Plantillas para otras profesiones</h2>
          <ul class="others">${others}</ul>
        </div>
      </section>
    </main>
    <footer>
      <div class="wrap">
        <span>proposio</span>
        <a href="./">Inicio</a>
        <a href="privacidad.html">Privacidad</a>
        <a href="condiciones.html">Condiciones</a>
      </div>
    </footer>
  </body>
</html>
`
}

function sitemap() {
  const urls = ['', 'app.html', ...PAGES.map((p) => p.file), 'privacidad.html', 'condiciones.html']
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}
</urlset>
`
}

export function buildPages() {
  for (const p of PAGES) {
    if (!SAMPLE_PROFESSIONS.some((s) => s.id === p.id)) throw new Error(`No hay ejemplo para ${p.id}`)
    writeFileSync(p.file, page(p))
  }
  writeFileSync('sitemap.xml', sitemap())
  console.log(`${PAGES.length} páginas por profesión y sitemap.xml generados`)
}

if (import.meta.url === `file://${process.argv[1]}`) buildPages()
