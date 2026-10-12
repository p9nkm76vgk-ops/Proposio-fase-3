// Carga jsPDF solo cuando hace falta (al pulsar «Descargar PDF").
//
// - En desarrollo (`npm run dev`) se carga desde node_modules.
// - En la versión publicada (index.html generado con `npm run build`), build.mjs
//   sustituye este archivo por uno que descarga jsPDF desde un CDN público.
//   Solo se descarga la librería: ningún dato de la propuesta sale del navegador.

export async function loadJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}
