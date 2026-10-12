// Carga la librería de Supabase solo cuando las cuentas están activadas.
//
// - En desarrollo (`npm run dev`) se carga desde node_modules.
// - En la versión publicada (index.html generado con `npm run build`), build.mjs
//   sustituye este archivo por uno que la descarga desde un CDN con versión fija.

export async function loadCreateClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient
}
