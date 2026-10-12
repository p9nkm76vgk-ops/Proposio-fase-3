// Genera app.html (el editor) y ver.html (la propuesta que ve el cliente), cada uno en UN SOLO ARCHIVO.
// (index.html es la página comercial, escrita a mano, y no se toca.)
//
// Por qué: GitHub Pages (y cualquier alojamiento estático) sirve los archivos tal cual,
// sin "construir" el proyecto. Un navegador no puede ejecutar .jsx directamente, así que
// se publica un app.html que ya lleva dentro todo el código y los estilos.
//
// Uso (desde esta carpeta):  npm run build
// Después, sube app.html y ver.html nuevos a GitHub.

import { readFileSync, writeFileSync } from 'node:fs'
import * as esbuild from 'esbuild'
import { buildPages } from './pages.mjs'

// Librerías que la versión publicada descarga de CDNs públicos, con versión fija.
// Solo se descarga el código de la librería: ningún dato de las propuestas sale del navegador.
const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/dist/umd/supabase.js'

/** Código de un cargador que inserta un <script> y devuelve lo que la librería deja en window. */
function scriptLoader({ exportName, url, getGlobal, errorMessage }) {
  return `
    let pending = null
    export function ${exportName}() {
      const ready = () => (${getGlobal})
      if (ready()) return Promise.resolve(ready())
      if (!pending) {
        pending = new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = ${JSON.stringify(url)}
          script.async = true
          script.crossOrigin = 'anonymous'
          script.referrerPolicy = 'no-referrer'
          const fail = () => {
            pending = null
            script.remove()
            const error = new Error('No se pudo cargar ' + ${JSON.stringify(url)})
            error.userMessage = ${JSON.stringify(errorMessage)}
            reject(error)
          }
          script.onload = () => (ready() ? resolve(ready()) : fail())
          script.onerror = fail
          document.head.appendChild(script)
        })
      }
      return pending
    }`
}

// Sustituye los cargadores de desarrollo (que usan node_modules) por cargadores desde CDN.
const cdnLoaders = {
  name: 'cdn-loaders',
  setup(build) {
    const replacements = {
      './jspdfLoader.js': scriptLoader({
        exportName: 'loadJsPDF',
        url: JSPDF_CDN,
        getGlobal: 'window.jspdf && window.jspdf.jsPDF',
        errorMessage: 'No se pudo cargar el generador de PDF. Comprueba tu conexión a internet y vuelve a intentarlo.',
      }),
      './supabaseLoader.js': scriptLoader({
        exportName: 'loadCreateClient',
        url: SUPABASE_CDN,
        getGlobal: 'window.supabase && window.supabase.createClient',
        errorMessage: 'No se pudo conectar con el servidor de cuentas. Comprueba tu conexión a internet.',
      }),
    }
    build.onResolve({ filter: /^\.\/(jspdfLoader|supabaseLoader)\.js$/ }, (args) => ({ path: args.path, namespace: 'cdn' }))
    build.onLoad({ filter: /.*/, namespace: 'cdn' }, (args) => ({ loader: 'js', contents: replacements[args.path] }))
  },
}

/** Empaqueta una página (entrada .jsx + plantilla de desarrollo) en un único archivo .html. */
async function buildPage({ entry, template: templateFile, output }) {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    outdir: 'build-tmp', // no se escribe en disco: write: false
    plugins: [cdnLoaders],
    logLevel: 'warning',
  })

  const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script')
  const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text

  const template = readFileSync(templateFile, 'utf8')
  const devScript = `<script type="module" src="./${entry}"></script>`
  if (!template.includes(devScript)) throw new Error(`${templateFile} no contiene el script de desarrollo esperado`)

  // Se usan funciones en replace() para que los "$" del código minificado no se interpreten como patrones.
  const html = template
    .replace('<head>', () => '<head>\n    <!-- ARCHIVO GENERADO con "npm run build". No lo edites a mano: edita los .jsx/.js/.css y vuelve a generarlo. -->')
    .replace('</head>', () => `    <style>${css}</style>\n  </head>`)
    .replace(devScript, () => `<script>${js}</script>`)

  if (html.includes(devScript)) throw new Error(`No se pudo sustituir el script de ${templateFile}`)
  writeFileSync(output, html)
  console.log(`${output} generado (${Math.round(html.length / 1024)} KB)`)
}

// app.html: el editor de propuestas.  ver.html: la página que ve el cliente al abrir un enlace.
await buildPage({ entry: 'main.jsx', template: 'dev.html', output: 'app.html' })
await buildPage({ entry: 'ver.jsx', template: 'ver-dev.html', output: 'ver.html' })
// Páginas «Plantilla de presupuesto para…» y sitemap.xml
buildPages()
