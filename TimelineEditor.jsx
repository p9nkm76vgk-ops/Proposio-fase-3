// Fases del proyecto (opcional): nombre de la fase y plazo, en forma de tabla.

import { useEffect, useState } from 'react'
import { createPhase } from './proposal.js'
import { LIMITS, fieldIdFromPath } from './validation.js'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from './Icons.jsx'

export function TimelineEditor({ phases, onChange, errorFor, onBlur }) {
  const [focusId, setFocusId] = useState(null)

  useEffect(() => {
    if (!focusId) return
    document.getElementById(fieldIdFromPath(`phases.${focusId}.name`))?.focus()
    setFocusId(null)
  }, [focusId])

  const update = (id, key, value) => onChange(phases.map((ph) => (ph.id === id ? { ...ph, [key]: value } : ph)))

  const add = () => {
    if (phases.length >= LIMITS.maxPhases) return
    const phase = createPhase()
    onChange([...phases, phase])
    setFocusId(phase.id)
  }

  const remove = (id) => onChange(phases.filter((ph) => ph.id !== id))

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= phases.length) return
    const next = [...phases]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="phases">
      <span className="field__label">
        Fases del proyecto <span className="field__optional">(opcional)</span>
      </span>
      <p className="field__hint">Se mostrarán como una tabla debajo del texto de plazos.</p>
      {phases.length > 0 && (
        <ol className="phases__rows">
          {phases.map((ph, index) => {
            const namePath = `phases.${ph.id}.name`
            const nameError = errorFor(namePath)
            return (
              <li key={ph.id} className="phases__row">
                <div className="phases__cell">
                  <label className="visually-hidden" htmlFor={fieldIdFromPath(namePath)}>
                    Nombre de la fase {index + 1}
                  </label>
                  <input
                    id={fieldIdFromPath(namePath)}
                    className="field__control"
                    value={ph.name}
                    maxLength={LIMITS.phaseName}
                    placeholder="Ej.: Diseño"
                    onChange={(e) => update(ph.id, 'name', e.target.value)}
                    onBlur={() => onBlur(namePath)}
                    aria-invalid={nameError ? 'true' : undefined}
                    aria-describedby={nameError ? `${fieldIdFromPath(namePath)}-error` : undefined}
                  />
                  {nameError && (
                    <p className="field__error" id={`${fieldIdFromPath(namePath)}-error`}>
                      {nameError}
                    </p>
                  )}
                </div>
                <div className="phases__cell phases__cell--duration">
                  <label className="visually-hidden" htmlFor={`phase-duration-${ph.id}`}>
                    Plazo de la fase {index + 1}
                  </label>
                  <input
                    id={`phase-duration-${ph.id}`}
                    className="field__control"
                    value={ph.duration}
                    maxLength={LIMITS.phaseDuration}
                    placeholder="Ej.: Semana 1"
                    onChange={(e) => update(ph.id, 'duration', e.target.value)}
                  />
                </div>
                <div className="list-editor__actions">
                  <button type="button" className="icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir fase ${index + 1}`} title="Subir">
                    <ArrowUpIcon size={16} />
                  </button>
                  <button type="button" className="icon-button" onClick={() => move(index, 1)} disabled={index === phases.length - 1} aria-label={`Bajar fase ${index + 1}`} title="Bajar">
                    <ArrowDownIcon size={16} />
                  </button>
                  <button type="button" className="icon-button icon-button--danger" onClick={() => remove(ph.id)} aria-label={`Eliminar fase ${index + 1}`} title="Eliminar">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <button type="button" className="button button--ghost button--small" onClick={add} disabled={phases.length >= LIMITS.maxPhases}>
        <PlusIcon size={16} /> Añadir fase
      </button>
    </div>
  )
}
