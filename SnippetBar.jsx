// Barra de "textos guardados" debajo de un campo de texto largo.
// Permite guardar el texto actual y reutilizar textos guardados en otras propuestas.

import { useId, useState } from 'react'
import { MAX_SNIPPETS_PER_FIELD, SNIPPET_FIELDS, addSnippet, loadSnippets, removeSnippet } from './snippets.js'
import { BookmarkIcon, TrashIcon } from './Icons.jsx'

const REASONS = {
  empty: 'Escribe algo antes de guardarlo.',
  duplicate: 'Este texto ya está guardado.',
  full: `Puedes guardar hasta ${MAX_SNIPPETS_PER_FIELD} textos por campo. Elimina alguno para añadir otro.`,
  storage: 'No se pudo guardar en este navegador (puede estar en modo privado).',
}

export function SnippetBar({ field, value, onInsert }) {
  const [snippets, setSnippets] = useState(() => loadSnippets(field))
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const listId = useId()
  const name = SNIPPET_FIELDS[field] ?? 'este campo'

  const save = () => {
    const result = addSnippet(field, value)
    setSnippets(result.list)
    setMessage(result.ok ? { type: 'ok', text: 'Texto guardado para próximas propuestas.' } : { type: 'error', text: REASONS[result.reason] })
  }

  const insert = (text) => {
    const current = value.trim()
    onInsert(current ? `${current}\n\n${text}` : text)
    setMessage({ type: 'ok', text: current ? 'Texto añadido al final.' : 'Texto insertado.' })
  }

  const remove = (id) => {
    setSnippets(removeSnippet(field, id))
    setMessage({ type: 'ok', text: 'Texto eliminado.' })
  }

  return (
    <div className="snippets">
      <div className="snippets__bar">
        <button
          type="button"
          className="link-button"
          onClick={save}
          disabled={value.trim() === ''}
          title={`Guardar este texto de ${name} para reutilizarlo`}
        >
          <BookmarkIcon size={15} /> Guardar texto
        </button>
        {snippets.length > 0 && (
          <button
            type="button"
            className="link-button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            Textos guardados ({snippets.length})
          </button>
        )}
        {message && (
          <span className={`snippets__message snippets__message--${message.type}`} role="status">
            {message.text}
          </span>
        )}
      </div>
      {open && snippets.length > 0 && (
        <ul className="snippets__list" id={listId}>
          {snippets.map((s) => (
            <li key={s.id} className="snippets__item">
              <p className="snippets__text">{s.text}</p>
              <div className="snippets__actions">
                <button type="button" className="button button--ghost button--small" onClick={() => insert(s.text)}>
                  Insertar
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={() => remove(s.id)}
                  aria-label="Eliminar texto guardado"
                  title="Eliminar"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
