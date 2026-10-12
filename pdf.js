// Generación del PDF con jsPDF, directamente en el navegador.
// Ningún dato del cliente sale del dispositivo del usuario.
//
// Estructura:
//   renderProposalPdf(pdf, model)  -> dibuja el documento en una instancia de jsPDF
//   createProposalPdf(JsPDF, p)    -> crea la instancia y la rellena
//   downloadProposalPdf(p)         -> carga jsPDF bajo demanda y descarga el archivo
//
// Plantillas: 'classic', 'modern' y 'minimal' (ver THEMES). El color de acento y el
// logotipo vienen de model.design. Unidades: milímetros. Página A4 (210 × 297 mm).

import { buildDocument } from './document.js'
import { slugify } from './format.js'
import { loadJsPDF } from './jspdfLoader.js'
import { toPdfSafeText } from './pdfText.js'
import { accentPalette } from './templates.js'

const PAGE = { width: 210, height: 297, marginX: 20, top: 20, bottom: 272, footerY: 284 }
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2

const NEUTRAL = {
  ink: [17, 30, 48],
  text: [55, 65, 81],
  muted: [107, 114, 128],
  line: [222, 228, 234],
  white: [255, 255, 255],
}

const THEMES = {
  classic: { header: 'bar', headingFont: 'helvetica', numbered: true, tableHead: 'soft', titleFont: 'helvetica', titleStyle: 'bold' },
  modern: { header: 'band', headingFont: 'helvetica', numbered: false, tableHead: 'accent', titleFont: 'helvetica', titleStyle: 'bold' },
  minimal: { header: 'plain', headingFont: 'times', numbered: false, tableHead: 'rule', titleFont: 'times', titleStyle: 'normal' },
}

const PT_TO_MM = 0.3528
const lineHeight = (sizePt, factor = 1.45) => sizePt * PT_TO_MM * factor

/** Tamaño del logotipo ajustado a un máximo, sin deformarlo. */
function fitLogo(logo, maxW, maxH) {
  const ratio = logo.width / logo.height
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w, h }
}

export function renderProposalPdf(pdf, model) {
  const theme = THEMES[model.design.template] ?? THEMES.classic
  const palette = accentPalette(model.design.accent)
  const logo = model.design.logo
  const x0 = PAGE.marginX
  let y = PAGE.top

  const font = (style, size, color = NEUTRAL.text, family = 'helvetica') => {
    pdf.setFont(family, style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
  }

  const newPage = () => {
    pdf.addPage()
    y = PAGE.top
  }

  /** Si no caben `height` mm en la página actual, pasa a la siguiente. */
  const ensureSpace = (height) => {
    if (y + height > PAGE.bottom) newPage()
  }

  const wrap = (text, width) => pdf.splitTextToSize(toPdfSafeText(text), width)

  const drawLine = (x1, y1, x2, y2, color = NEUTRAL.line, width = 0.3) => {
    pdf.setDrawColor(...color)
    pdf.setLineWidth(width)
    pdf.line(x1, y1, x2, y2)
  }

  const drawLogo = (x, top, size) => {
    const format = logo.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
    pdf.addImage(logo.dataUrl, format, x, top, size.w, size.h)
  }

  /**
   * Escribe un texto con saltos de línea y de página automáticos.
   * Respeta los párrafos (líneas en blanco) que escribió el usuario.
   */
  const paragraph = (text, { x = x0, width = CONTENT_WIDTH, size = 10.5, style = 'normal', color = NEUTRAL.text } = {}) => {
    const lh = lineHeight(size)
    toPdfSafeText(text)
      .split('\n')
      .forEach((block) => {
        if (block.trim() === '') {
          y += lh * 0.55
          return
        }
        font(style, size, color)
        pdf.splitTextToSize(block, width).forEach((line) => {
          ensureSpace(lh)
          font(style, size, color)
          pdf.text(line, x, y, { baseline: 'top' })
          y += lh
        })
      })
  }

  // ───────────── Cabecera de la primera página ─────────────
  const titleSize = theme.titleFont === 'times' ? 25 : 22
  const titleLh = lineHeight(titleSize, 1.2)

  if (theme.header === 'band') {
    // Banda de color con el título dentro y el logotipo en una caja blanca a la derecha
    const logoSize = logo ? fitLogo(logo, 38, 16) : null
    const boxW = logoSize ? logoSize.w + 8 : 0
    const boxH = logoSize ? logoSize.h + 8 : 0
    font(theme.titleStyle, titleSize, palette.onAccent, theme.titleFont)
    const titleLines = wrap(model.title, CONTENT_WIDTH - (boxW ? boxW + 8 : 0))
    const textBottom = 26 + titleLines.length * titleLh
    const bandH = Math.max(textBottom + 10, logoSize ? 16 + boxH + 10 : 0)

    pdf.setFillColor(...palette.accent)
    pdf.rect(0, 0, PAGE.width, bandH, 'F')
    font('bold', 8.5, palette.onAccent)
    pdf.text('PROPUESTA COMERCIAL', x0, 18, { baseline: 'top' })
    font(theme.titleStyle, titleSize, palette.onAccent, theme.titleFont)
    titleLines.forEach((line, i) => pdf.text(line, x0, 26 + i * titleLh, { baseline: 'top' }))
    if (logoSize) {
      const bx = x0 + CONTENT_WIDTH - boxW
      pdf.setFillColor(...NEUTRAL.white)
      pdf.rect(bx, 16, boxW, boxH, 'F')
      drawLogo(bx + 4, 20, logoSize)
    }
    y = bandH + 10
  } else {
    if (theme.header === 'bar') {
      pdf.setFillColor(...palette.accent)
      pdf.rect(0, 0, PAGE.width, 3, 'F')
    }
    y = theme.header === 'bar' ? 20 : 22
    if (logo) {
      const size = fitLogo(logo, 50, 18)
      drawLogo(x0, y, size)
      y += size.h + 8
    }
    font('bold', 8.5, palette.text)
    pdf.text(theme.header === 'plain' ? 'Propuesta comercial'.toUpperCase() : 'PROPUESTA COMERCIAL', x0, y, { baseline: 'top' })
    y += 7
    font(theme.titleStyle, titleSize, NEUTRAL.ink, theme.titleFont)
    wrap(model.title, CONTENT_WIDTH).forEach((line) => {
      pdf.text(line, x0, y, { baseline: 'top' })
      y += titleLh
    })
    y += 6
  }

  // Dos columnas: profesional / cliente
  const colGap = 10
  const colWidth = (CONTENT_WIDTH - colGap) / 2
  const partyBlock = (label, party, x) => {
    let cy = y
    font('bold', 7.5, NEUTRAL.muted)
    pdf.text(label, x, cy, { baseline: 'top' })
    cy += 5
    font('bold', 11, NEUTRAL.ink)
    wrap(party.name, colWidth).forEach((line) => {
      pdf.text(line, x, cy, { baseline: 'top' })
      cy += lineHeight(11, 1.3)
    })
    if (party.contact) {
      cy += 0.5
      font('normal', 9.5, NEUTRAL.text)
      wrap(party.contact, colWidth).forEach((line) => {
        pdf.text(line, x, cy, { baseline: 'top' })
        cy += lineHeight(9.5, 1.35)
      })
    }
    return cy
  }
  const leftEnd = partyBlock('PREPARADA POR', model.professional, x0)
  const rightEnd = partyBlock('PARA', model.client, x0 + colWidth + colGap)
  y = Math.max(leftEnd, rightEnd) + 5

  // Fecha y validez
  const meta = [`Fecha de emisión: ${model.issueDate}`]
  if (model.validUntil) meta.push(`Válida hasta: ${model.validUntil} (${model.validityDays} días)`)
  font('normal', 9, NEUTRAL.muted)
  wrap(meta.join('     ·     '), CONTENT_WIDTH).forEach((line) => {
    pdf.text(line, x0, y, { baseline: 'top' })
    y += lineHeight(9)
  })
  y += 4
  if (theme.header === 'plain') drawLine(x0, y, x0 + CONTENT_WIDTH, y, NEUTRAL.ink, 0.25)
  else if (theme.header === 'band') drawLine(x0, y, x0 + CONTENT_WIDTH, y, NEUTRAL.line, 0.4)
  else drawLine(x0, y, x0 + CONTENT_WIDTH, y, NEUTRAL.ink, 0.5)
  y += 9

  // ───────────── Elementos de las secciones ─────────────
  const sectionHeading = (section) => {
    const size = theme.headingFont === 'times' ? 14 : 12.5
    // Mantiene el título junto a, al menos, unas líneas de contenido.
    ensureSpace(lineHeight(size) + lineHeight(10.5) * 3 + 4)
    const indent = theme.numbered ? 10 : 0
    if (theme.numbered) {
      font('bold', 9, palette.text)
      pdf.text(section.number, x0, y + 0.9, { baseline: 'top' })
    }
    const color = theme.header === 'band' ? palette.text : NEUTRAL.ink
    font('bold', size, color, theme.headingFont)
    wrap(section.title, CONTENT_WIDTH - indent).forEach((line) => {
      pdf.text(line, x0 + indent, y, { baseline: 'top' })
      y += lineHeight(size, 1.3)
    })
    if (theme.header === 'band') {
      pdf.setFillColor(...palette.accent)
      pdf.rect(x0, y + 0.3, 12, 0.8, 'F')
      y += 3
    }
    y += 2
  }

  const list = (items, ordered) => {
    const size = 10.5
    const lh = lineHeight(size)
    const indent = 7
    items.forEach((item, index) => {
      font('normal', size, NEUTRAL.text)
      const lines = pdf.splitTextToSize(toPdfSafeText(item.text), CONTENT_WIDTH - indent)
      lines.forEach((line, i) => {
        ensureSpace(lh)
        if (i === 0) {
          font('bold', size, palette.text)
          pdf.text(ordered ? `${index + 1}.` : '•', x0 + 1, y, { baseline: 'top' })
        }
        font('normal', size, NEUTRAL.text)
        pdf.text(line, x0 + indent, y, { baseline: 'top' })
        y += lh
      })
      if (item.detail) {
        y += 0.4
        paragraph(item.detail, { x: x0 + indent, width: CONTENT_WIDTH - indent, size: 9.5, color: NEUTRAL.muted })
      }
      y += 1.4
    })
  }

  /**
   * Tabla genérica con ajuste de línea, salto de página y cabecera repetida.
   * columns: [{ key, label, width (mm, o null = ancho restante), align }]
   */
  const table = (columns, rows) => {
    const padX = 3
    const size = 10
    const lh = lineHeight(size, 1.35)
    const fixed = columns.reduce((sum, c) => sum + (c.width ?? 0), 0)
    const flex = CONTENT_WIDTH - fixed
    const cols = columns.map((c) => ({ ...c, w: c.width ?? flex }))
    let cx = x0
    cols.forEach((c) => {
      c.x = cx
      cx += c.w
    })
    const cellX = (c) => (c.align === 'right' ? c.x + c.w - padX : c.x + padX)

    const header = () => {
      const h = 8
      ensureSpace(h + lh + 5)
      if (theme.tableHead === 'soft' || theme.tableHead === 'accent') {
        pdf.setFillColor(...(theme.tableHead === 'accent' ? palette.accent : palette.soft))
        pdf.rect(x0, y, CONTENT_WIDTH, h, 'F')
      }
      const color = theme.tableHead === 'accent' ? palette.onAccent : NEUTRAL.muted
      font('bold', 7.5, color)
      cols.forEach((c) => pdf.text(c.label.toUpperCase(), cellX(c), y + 2.8, { baseline: 'top', align: c.align ?? 'left' }))
      y += h
      if (theme.tableHead === 'rule') drawLine(x0, y, x0 + CONTENT_WIDTH, y, NEUTRAL.ink, 0.3)
    }

    header()
    rows.forEach((row) => {
      font('normal', size, NEUTRAL.text)
      const wrapped = cols.map((c) => pdf.splitTextToSize(toPdfSafeText(row[c.key] ?? ''), c.w - padX * 2))
      const rowHeight = Math.max(...wrapped.map((l) => l.length)) * lh + 5
      if (y + rowHeight > PAGE.bottom) {
        newPage()
        header()
      }
      const top = y + 2.5
      cols.forEach((c, ci) => {
        font(c.strong ? 'bold' : 'normal', size, c.strong ? NEUTRAL.ink : NEUTRAL.text)
        wrapped[ci].forEach((line, li) => pdf.text(line, cellX(c), top + li * lh, { baseline: 'top', align: c.align ?? 'left' }))
      })
      y += rowHeight
      drawLine(x0, y, x0 + CONTENT_WIDTH, y)
    })
  }

  const timeline = (section) => {
    if (section.text) paragraph(section.text)
    if (section.phases.length) {
      if (section.text) y += 3
      table(
        [
          { key: 'name', label: 'Fase', width: null },
          { key: 'duration', label: 'Plazo', width: 48, align: 'right', strong: true },
        ],
        section.phases,
      )
    }
  }

  const pricing = (section) => {
    const columns = section.showQuantities
      ? [
          { key: 'concept', label: 'Concepto', width: null },
          { key: 'quantity', label: 'Cant.', width: 16, align: 'right' },
          { key: 'unitPrice', label: 'Precio', width: 30, align: 'right' },
          { key: 'value', label: 'Importe', width: 32, align: 'right', strong: true },
        ]
      : [
          { key: 'concept', label: 'Concepto', width: null },
          { key: 'value', label: 'Importe', width: 40, align: 'right', strong: true },
        ]
    table(columns, section.rows)

    // Totales alineados a la derecha
    y += 3
    const blockW = 95
    const labelX = x0 + CONTENT_WIDTH - blockW
    const rightX = x0 + CONTENT_WIDTH - 3
    section.totals.forEach((total) => {
      const size = total.emphasis ? 11.5 : 10
      const rowH = lineHeight(size, 1.5)
      ensureSpace(rowH + (total.emphasis ? 5 : 0))
      if (total.emphasis) {
        if (theme.tableHead === 'accent') {
          pdf.setFillColor(...palette.accent)
          pdf.rect(labelX, y, blockW, rowH + 3, 'F')
          y += 1.5
        } else {
          drawLine(labelX, y, x0 + CONTENT_WIDTH, y, NEUTRAL.ink, 0.4)
          y += 2.5
        }
      }
      const color = total.emphasis ? (theme.tableHead === 'accent' ? palette.onAccent : NEUTRAL.ink) : NEUTRAL.text
      font(total.emphasis ? 'bold' : 'normal', size, color)
      pdf.text(toPdfSafeText(total.label), labelX + 3, y, { baseline: 'top' })
      pdf.text(toPdfSafeText(total.value), rightX, y, { baseline: 'top', align: 'right' })
      y += rowH + (total.emphasis && theme.tableHead === 'accent' ? 1.5 : 0)
    })

    if (section.note) {
      y += 2
      paragraph(section.note, { size: 9, color: NEUTRAL.muted })
    }
  }

  model.sections.forEach((section, index) => {
    if (index > 0) y += 7
    sectionHeading(section)
    if (section.type === 'text') paragraph(section.text)
    else if (section.type === 'list') list(section.items, section.ordered)
    else if (section.type === 'timeline') timeline(section)
    else if (section.type === 'pricing') pricing(section)
  })

  // ───────────── Pie de página en todas las páginas ─────────────
  const pages = pdf.getNumberOfPages()
  const footerLeft = toPdfSafeText(`${model.professional.name} · ${model.title}`)
  for (let i = 1; i <= pages; i += 1) {
    pdf.setPage(i)
    drawLine(x0, PAGE.footerY - 3, x0 + CONTENT_WIDTH, PAGE.footerY - 3)
    font('normal', 8, NEUTRAL.muted)
    const left = pdf.splitTextToSize(footerLeft, CONTENT_WIDTH - 35)[0] ?? ''
    const truncated = left.length < footerLeft.length ? `${left.replace(/\s+\S*$/, '')}…` : left
    pdf.text(truncated, x0, PAGE.footerY, { baseline: 'top' })
    pdf.text(`Página ${i} de ${pages}`, x0 + CONTENT_WIDTH, PAGE.footerY, { baseline: 'top', align: 'right' })
  }

  return pdf
}

export function createProposalPdf(JsPDF, proposal) {
  const model = buildDocument(proposal)
  const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  pdf.setProperties({
    title: toPdfSafeText(`Propuesta: ${model.title}`),
    subject: 'Propuesta comercial',
    author: toPdfSafeText(model.professional.name),
    creator: 'proposio',
  })
  return renderProposalPdf(pdf, model)
}

export function proposalFileName(proposal) {
  const parts = [slugify(proposal.client?.name, 30), slugify(proposal.project?.title, 40)].filter(Boolean)
  return `propuesta-${parts.join('-') || 'sin-titulo'}.pdf`
}

/**
 * Descarga el PDF. jsPDF se carga solo cuando hace falta,
 * así la primera carga de la app es más rápida.
 */
export async function downloadProposalPdf(proposal) {
  const jsPDF = await loadJsPDF()
  const pdf = createProposalPdf(jsPDF, proposal)
  pdf.save(proposalFileName(proposal))
}
