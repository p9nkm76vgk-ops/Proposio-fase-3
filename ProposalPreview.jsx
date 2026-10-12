// Vista previa en HTML del documento. Usa el mismo modelo que el PDF (buildDocument),
// por lo que el contenido y el orden coinciden con el archivo descargado.
// La plantilla y el color se aplican con clases y variables CSS (ver styles.css, "Documento").

import { memo } from 'react'
import { accentCssVars } from './templates.js'

function Placeholder({ children }) {
  return <span className="doc__placeholder">{children}</span>
}

function TextBlock({ text }) {
  // Respeta párrafos (línea en blanco) y saltos de línea simples.
  return text.split(/\n\s*\n/).map((para, i) => (
    <p key={i}>
      {para.split('\n').map((line, j, arr) => (
        <span key={j}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ))}
    </p>
  ))
}

function ListBlock({ section }) {
  const Tag = section.ordered ? 'ol' : 'ul'
  return (
    <Tag className={`doc__list ${section.ordered ? 'doc__list--ordered' : ''}`}>
      {section.items.map((item, i) => (
        <li key={i}>
          {item.text}
          {item.detail && <span className="doc__detail">{item.detail}</span>}
        </li>
      ))}
    </Tag>
  )
}

function TimelineBlock({ section }) {
  return (
    <>
      {section.text && <TextBlock text={section.text} />}
      {section.phases.length > 0 && (
        <div className="doc__table-wrap">
          <table className="doc__table">
            <thead>
              <tr>
                <th scope="col">Fase</th>
                <th scope="col" className="num">
                  Plazo
                </th>
              </tr>
            </thead>
            <tbody>
              {section.phases.map((ph, i) => (
                <tr key={i}>
                  <td>{ph.name}</td>
                  <td className="num strong">{ph.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PricingBlock({ section }) {
  return (
    <>
      <div className="doc__table-wrap">
        <table className="doc__table">
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              {section.showQuantities && (
                <>
                  <th scope="col" className="num">
                    Cant.
                  </th>
                  <th scope="col" className="num">
                    Precio
                  </th>
                </>
              )}
              <th scope="col" className="num">
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.concept}</td>
                {section.showQuantities && (
                  <>
                    <td className="num">{row.quantity}</td>
                    <td className="num">{row.unitPrice}</td>
                  </>
                )}
                <td className="num strong">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="doc__totals">
        {section.totals.map((t) => (
          <div key={t.label} className={t.emphasis ? 'doc__total doc__total--main' : 'doc__total'}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>
      {!section.valid && <p className="doc__warning">Hay importes sin completar o no válidos.</p>}
      {section.note && <p className="doc__note">{section.note}</p>}
    </>
  )
}

function ProposalPreviewInner({ model }) {
  const isEmpty = model.sections.length === 0 && !model.title
  const { template, accent, logo } = model.design
  const logoImg = logo && <img className="doc__logo" src={logo.dataUrl} alt="Logotipo" />

  return (
    <article className={`doc doc--${template}`} style={accentCssVars(accent)} aria-label="Vista previa de la propuesta">
      <header className="doc__header">
        <div className="doc__header-text">
          {template !== 'modern' && logoImg}
          <p className="doc__eyebrow">Propuesta comercial</p>
          <h1 className="doc__title">{model.title || <Placeholder>Título del proyecto</Placeholder>}</h1>
        </div>
        {template === 'modern' && logo && <span className="doc__logo-box">{logoImg}</span>}
      </header>

      <div className="doc__parties">
        <div>
          <p className="doc__label">Preparada por</p>
          <p className="doc__party">{model.professional.name || <Placeholder>Tu nombre o empresa</Placeholder>}</p>
          {model.professional.contact && <p className="doc__contact">{model.professional.contact}</p>}
        </div>
        <div>
          <p className="doc__label">Para</p>
          <p className="doc__party">{model.client.name || <Placeholder>Cliente</Placeholder>}</p>
          {model.client.contact && <p className="doc__contact">{model.client.contact}</p>}
        </div>
      </div>

      <p className="doc__meta">
        Fecha de emisión: {model.issueDate || <Placeholder>sin fecha</Placeholder>}
        {model.validUntil && (
          <>
            <span aria-hidden="true"> · </span>
            Válida hasta: {model.validUntil} ({model.validityDays} días)
          </>
        )}
      </p>

      <hr className="doc__rule" />

      {isEmpty && <p className="doc__empty">Completa el formulario y verás aquí tu propuesta, tal como quedará en el PDF.</p>}

      {model.sections.map((section) => (
        <section key={section.key} className="doc__section">
          <h2 className="doc__heading">
            {template === 'classic' && <span className="doc__number">{section.number}</span>}
            {section.title}
          </h2>
          {section.type === 'text' && <TextBlock text={section.text} />}
          {section.type === 'list' && <ListBlock section={section} />}
          {section.type === 'timeline' && <TimelineBlock section={section} />}
          {section.type === 'pricing' && <PricingBlock section={section} />}
        </section>
      ))}
    </article>
  )
}

export const ProposalPreview = memo(ProposalPreviewInner)
