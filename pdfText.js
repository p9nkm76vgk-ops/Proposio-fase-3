// Las fuentes estándar de PDF (Helvetica) usan la codificación WinAnsi.
// Incluye todo lo necesario para el español (á é í ó ú ü ñ ¿ ¡ « » €) pero no emojis
// ni algunos símbolos poco comunes. Esta función sustituye esos caracteres por
// equivalentes seguros para que el PDF nunca muestre símbolos rotos.

const WINANSI_EXTRA = new Set(
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''),
)

const REPLACEMENTS = {
  ' ': ' ', // espacio de no separación
  ' ': ' ', // espacio fino (lo usan algunos formatos de número)
  ' ': ' ',
  ' ': ' ',
  '​': '', // espacio de ancho cero
  '‐': '-',
  '‑': '-',
  '−': '-', // signo menos
  '→': '->',
  '←': '<-',
  '✓': '✓',
  '•': '•',
  '●': '•',
  '▪': '•',
  '′': "'",
  '″': '"',
  '\t': '    ',
}

function isWinAnsi(ch) {
  const code = ch.codePointAt(0)
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch) || ch === '\n'
}

function toWinAnsiChar(c) {
  if (isWinAnsi(c)) return c
  const code = c.codePointAt(0)
  if (code < 0x20) return '' // caracteres de control invisibles
  // Letras con acentos poco comunes (ő, ā...): se usa la letra base.
  const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (base && [...base].every(isWinAnsi)) return base
  // Emojis y pictogramas: se omiten.
  if (code >= 0x1f000 || (code >= 0x2600 && code <= 0x27bf) || (code >= 0xfe00 && code <= 0xfe0f) || code === 0x200d) {
    return ''
  }
  return '?'
}

export function toPdfSafeText(text) {
  if (!text) return ''
  let out = ''
  for (const ch of String(text).normalize('NFC')) {
    const replaced = REPLACEMENTS[ch] ?? ch
    for (const c of replaced) {
      out += toWinAnsiChar(c)
    }
  }
  return out
}
