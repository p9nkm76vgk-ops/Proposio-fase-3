// Plantillas del documento y utilidades de color.
// Las usan la vista previa (CSS) y el PDF, para que ambos se vean igual.

export const TEMPLATES = [
  { value: 'classic', label: 'Clásica', hint: 'Sobria, con secciones numeradas.' },
  { value: 'modern', label: 'Moderna', hint: 'Cabecera en color y tabla destacada.' },
  { value: 'minimal', label: 'Minimalista', hint: 'Títulos con serifa y mucho aire.' },
]

export const DEFAULT_TEMPLATE = 'classic'

/** Colores sugeridos. Todos tienen buen contraste sobre blanco y con texto blanco encima. */
export const ACCENT_PRESETS = [
  { value: '#20375A', label: 'Azul marino' },
  { value: '#2E6DA4', label: 'Azul' },
  { value: '#0F5F58', label: 'Verde petróleo' },
  { value: '#7A2335', label: 'Burdeos' },
  { value: '#A14A12', label: 'Teja' },
  { value: '#3A4250', label: 'Grafito' },
]

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].value

export function isTemplate(value) {
  return TEMPLATES.some((t) => t.value === value)
}

export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** Luminancia relativa (WCAG). */
function luminance([r, g, b]) {
  const lin = (c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Mezcla un color con blanco. amount = 0 → blanco, 1 → el color. */
export function tint(rgb, amount) {
  return rgb.map((c) => 255 - (255 - c) * amount)
}

const WHITE = [255, 255, 255]
const INK = [17, 30, 48]

/**
 * A partir del color elegido por el usuario calcula una paleta legible:
 *   accent   → el color tal cual (rellenos, líneas)
 *   text     → versión oscurecida si hace falta para leerse sobre blanco (4,5:1)
 *   onAccent → blanco o tinta, lo que se lea mejor encima del color
 *   soft     → tono muy claro para fondos
 */
export function accentPalette(hex) {
  const accent = hexToRgb(isHexColor(hex) ? hex : DEFAULT_ACCENT)
  let text = accent
  for (let i = 0; i < 20 && contrastRatio(text, WHITE) < 4.5; i += 1) {
    text = text.map((c) => c * 0.85)
  }
  const onAccent = contrastRatio(WHITE, accent) >= contrastRatio(INK, accent) ? WHITE : INK
  return {
    accent,
    text: text.map(Math.round),
    onAccent,
    soft: tint(accent, 0.08).map(Math.round),
    line: tint(accent, 0.25).map(Math.round),
  }
}

/** Paleta en formato CSS (para la vista previa). */
export function accentCssVars(hex) {
  const p = accentPalette(hex)
  return {
    '--doc-accent': rgbToHex(p.accent),
    '--doc-accent-text': rgbToHex(p.text),
    '--doc-on-accent': rgbToHex(p.onAccent),
    '--doc-accent-soft': rgbToHex(p.soft),
    '--doc-accent-line': rgbToHex(p.line),
  }
}
