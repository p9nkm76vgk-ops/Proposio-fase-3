// Lista editable de entregables: añadir, quitar, reordenar y añadir un detalle opcional.
// Pulsar Intro en un entregable crea uno nuevo debajo (más rápido al escribir).

import { useEffect, useState } from 'react'
import { createDeliverable } from './proposal.js'
import { LIMITS, fieldIdFromPath } from './validation.js'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from './Icons.jsx'

export function DeliverablesEditor({ items, onChange, error, errorFor }) {
  const [focusId, setFocusId] = useState(null)
  const [openDetails, setOpenDetails] = useState(() => new Set())
  const listErrorId = error ? `${fieldIdFromPath('deliverables')}-error` : undefined

  useEffect(() => {
    if (!focusId) return
    document.getElementById(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  const update = (id, key, value) => onChange(items.map((d) => (d.id === id ? { ...d, [key]: value } : d)))

  const addAfter = (index) => {
    if (items.length >= LIMITS.maxListItems) return
    const item = createDeliverable()
    const next = [...items]
    next.splice(index + 1, 0, item)
    onChange(next)
    setFocusId(fieldIdFromPath(`deliverables.${item.id}.text`))
  }

  const remove = (index) => {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length ? next : [createDeliverable()])
    const neighbour = next[Math.max(0, index - 1)]
    if (neighbour) setFocusId(fieldIdFromPath(`deliverables.${neighbour.id}.text`))
  }

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const showDetail = (id) => {
    setOpenDetails((prev) => new Set(prev).add(id))
    setFocusId(`deliverable-detail-${id}`)
  }

  return (
    <div className={`list-editor ${error ? 'field--error' : ''}`}>
      <ol className="list-editor__items" id={fieldIdFromPath('deliverables')} tabIndex={-1} aria-describedby={listErrorId}>
        {items.map((item, index) => {
          const textId = fieldIdFromPath(`deliverables.${item.id}.text`)
          const textError = errorFor(`deliverables.${item.id}.text`)
          const detailVisible = openDetails.has(item.id) || item.detail.trim() !== ''
          return (
            <li key={item.id} className="list-editor__row">
              <span className="list-editor__index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="list-editor__main">
                <label className="visually-hidden" htmlFor={textId}>
                  Entregable {index + 1}
                </label>
                <input
                  id={textId}
                  className="field__control"
                  value={item.text}
                  maxLength={LIMITS.listItem}
                  placeholder={index === 0 ? 'Ej.: Diseño del logotipo en 3 formatos' : 'Otro entregable'}
                  onChange={(e) => update(item.id, 'text', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addAfter(index)
                    }
                  }}
                  aria-invalid={textError ? 'true' : undefined}
                  aria-describedby={textError ? `${textId}-error` : undefined}
                />
                {textError && (
                  <p className="field__error" id={`${textId}-error`}>
                    {textError}
                  </p>
                )}
                {detailVisible ? (
                  <>
                    <label className="visually-hidden" htmlFor={`deliverable-detail-${item.id}`}>
                      Detalle del entregable {index + 1}
                    </label>
                    <textarea
                      id={`deliverable-detail-${item.id}`}
                      className="field__control list-editor__detail"
                      rows={2}
                      value={item.detail}
                      maxLength={LIMITS.detail}
                      placeholder="Detalle opcional: formato, alcance, cantidad…"
                      onChange={(e) => update(item.id, 'detail', e.target.value)}
                    />
                  </>
                ) : (
                  <button type="button" className="link-button list-editor__add-detail" onClick={() => showDetail(item.id)}>
                    + Añadir detalle
                  </button>
                )}
              </div>
              <div className="list-editor__actions">
                <button type="button" className="icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir entregable ${index + 1}`} title="Subir">
                  <ArrowUpIcon size={16} />
                </button>
                <button type="button" className="icon-button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Bajar entregable ${index + 1}`} title="Bajar">
                  <ArrowDownIcon size={16} />
                </button>
                <button type="button" className="icon-button icon-button--danger" onClick={() => remove(index)} aria-label={`Eliminar entregable ${index + 1}`} title="Eliminar">
                  <TrashIcon size={16} />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      {error && (
        <p className="field__error" id={listErrorId}>
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => addAfter(items.length - 1)}
        disabled={items.length >= LIMITS.maxListItems}
      >
        <PlusIcon size={16} /> Añadir entregable
      </button>
    </div>
  )
}
