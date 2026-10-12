// Extras opcionales: servicios que el cliente puede añadir con un clic al aceptar
// la propuesta por enlace (por ejemplo, «Mantenimiento 3 meses · 150 €»).
// No suman al total de la propuesta: aparecen aparte, en el PDF y en el enlace.

import { useEffect, useState } from 'react'
import { cloudEnabled } from './cloud.js'
import { createExtra } from './proposal.js'
import { LIMITS, fieldIdFromPath } from './validation.js'
import { PlusIcon, TrashIcon } from './Icons.jsx'

function ExtraCell({ path, label, errorFor, onBlur, className, ...props }) {
  const id = fieldIdFromPath(path)
  const error = errorFor(path)
  return (
    <div className={`price-editor__cell ${className}`}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__control"
        onBlur={() => onBlur(path)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function ExtrasEditor({ extras, onChange, errorFor, onBlur, locked, onLocked }) {
  const [focusId, setFocusId] = useState(null)

  useEffect(() => {
    if (!focusId) return
    document.getElementById(fieldIdFromPath(`extras.${focusId}.concept`))?.focus()
    setFocusId(null)
  }, [focusId])

  if (locked) {
    return (
      <div className="extras locked-panel">
        <p className="field__label">
          Extras opcionales <span className="pro-badge">Pro</span>
        </p>
        <p className="field__hint">
          Ofrece servicios adicionales (mantenimiento, más fotos, urgencia…)
          {cloudEnabled ? ' que tu cliente puede añadir con un clic al aceptar' : ' que aparecen aparte en la propuesta'}. Es una
          forma sencilla de vender más en cada propuesta.
        </p>
        {extras.length > 0 && (
          <p className="inline-note">
            Esta propuesta tiene {extras.length === 1 ? '1 extra guardado' : `${extras.length} extras guardados`} que no se
            mostrarán con tu plan actual.{' '}
            <button type="button" className="link-button" onClick={() => onChange([])}>
              Quitarlos
            </button>
          </p>
        )}
        <button type="button" className="button button--ghost button--small" onClick={onLocked}>
          Ver planes
        </button>
      </div>
    )
  }

  const update = (id, key, value) => onChange(extras.map((e) => (e.id === id ? { ...e, [key]: value } : e)))
  const add = () => {
    if (extras.length >= LIMITS.maxExtras) return
    const extra = createExtra()
    onChange([...extras, extra])
    setFocusId(extra.id)
  }

  return (
    <div className="extras">
      <p className="field__label">
        Extras opcionales <span className="field__optional">(opcional)</span>
      </p>
      <p className="field__hint">
        No suman al total: aparecen aparte en la propuesta
        {cloudEnabled ? ' y, si la envías por enlace, tu cliente puede marcarlos al aceptar' : ''}. Usa el mismo criterio de
        impuestos que en los conceptos.
      </p>
      {extras.length > 0 && (
        <ul className="extras__rows">
          {extras.map((extra, index) => (
            <li key={extra.id} className="extras__row">
              <ExtraCell
                path={`extras.${extra.id}.concept`}
                label={`Extra ${index + 1}`}
                className="price-editor__cell--concept"
                value={extra.concept}
                maxLength={LIMITS.concept}
                placeholder="Ej.: Mantenimiento durante 3 meses"
                onChange={(e) => update(extra.id, 'concept', e.target.value)}
                errorFor={errorFor}
                onBlur={onBlur}
              />
              <ExtraCell
                path={`extras.${extra.id}.price`}
                label={`Precio del extra ${index + 1}, en euros`}
                className="price-editor__cell--price"
                value={extra.price}
                inputMode="decimal"
                maxLength={LIMITS.amount}
                placeholder="0,00"
                onChange={(e) => update(extra.id, 'price', e.target.value)}
                errorFor={errorFor}
                onBlur={onBlur}
              />
              <button
                type="button"
                className="icon-button icon-button--danger price-editor__remove"
                onClick={() => onChange(extras.filter((e) => e.id !== extra.id))}
                aria-label={`Eliminar extra ${index + 1}`}
                title="Eliminar"
              >
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="button button--ghost button--small" onClick={add} disabled={extras.length >= LIMITS.maxExtras}>
        <PlusIcon size={16} /> Añadir extra
      </button>
    </div>
  )
}
