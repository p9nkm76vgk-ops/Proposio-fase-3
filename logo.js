// Prepara el logotipo que sube el usuario para usarlo en la vista previa y en el PDF.
// Todo ocurre en el navegador: la imagen no se envía a ningún servidor.
//
// - Acepta PNG, JPG, WebP y SVG (máx. 5 MB).
// - La reduce a un tamaño razonable y la convierte a PNG (mantiene la transparencia),
//   que es un formato que jsPDF entiende.
// - Si el resultado es pesado, la convierte a JPEG con fondo blanco para no llenar
//   el almacenamiento del navegador.

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 600
const MAX_DATAURL_CHARS = 400_000 // ≈ 300 KB

export class LogoError extends Error {}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new LogoError('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new LogoError('El archivo no parece una imagen válida.'))
    img.src = src
  })
}

export async function processLogoFile(file) {
  if (!file) throw new LogoError('No se ha seleccionado ningún archivo.')
  if (!LOGO_ACCEPT.split(',').includes(file.type)) {
    throw new LogoError('Formato no admitido. Usa PNG, JPG, WebP o SVG.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new LogoError('La imagen pesa más de 5 MB. Prueba con una versión más ligera.')
  }

  const img = await loadImage(await readAsDataUrl(file))
  const naturalW = img.naturalWidth || img.width || 600
  const naturalH = img.naturalHeight || img.height || 300
  if (!naturalW || !naturalH) throw new LogoError('No se pudo leer el tamaño de la imagen.')

  const scale = Math.min(1, MAX_SIDE / Math.max(naturalW, naturalH))
  const width = Math.max(1, Math.round(naturalW * scale))
  const height = Math.max(1, Math.round(naturalH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  let dataUrl = canvas.toDataURL('image/png')
  if (dataUrl.length > MAX_DATAURL_CHARS) {
    // Imagen tipo fotografía: JPEG con fondo blanco ocupa mucho menos.
    const flat = document.createElement('canvas')
    flat.width = width
    flat.height = height
    const fctx = flat.getContext('2d')
    fctx.fillStyle = '#ffffff'
    fctx.fillRect(0, 0, width, height)
    fctx.drawImage(canvas, 0, 0)
    dataUrl = flat.toDataURL('image/jpeg', 0.85)
  }

  return { dataUrl, width, height, name: file.name.slice(0, 80) }
}
