// Logotipo de proposio en SVG (versión vectorial del diseño original).
// Dos mitades entrelazadas y una flecha ascendente. Decorativo: aria-hidden.

export function BrandMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M29 7 L12.5 23.5 Q9 27 12.5 30.5 L19.5 37.5" stroke="#20375A" strokeWidth="6.5" />
        <path d="M35 13 L51.5 29.5 Q55 33 51.5 36.5 L37 51" stroke="#4A90BA" strokeWidth="6.5" />
        <path d="M13 54 L39 28" stroke="#FFFFFF" strokeWidth="12" />
        <path d="M13 54 L39 28" stroke="#20375A" strokeWidth="6.5" />
      </g>
      <path d="M30 22 H45 V37 Z" fill="#20375A" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke" />
    </svg>
  )
}
