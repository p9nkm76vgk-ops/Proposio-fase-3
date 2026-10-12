// Ventana «Mi catálogo»: añade a la propuesta servicios guardados con su precio
// y guarda en el catálogo los conceptos de la propuesta actual.

import { useEffect, useState } from 'react'
import { Modal } from './Feedback.jsx'
import { BookmarkIcon, PlusIcon, TrashIcon } from './Icons.jsx'
import { MAX_CATALOG_ITEMS, addToCatalog, loadCatalog, removeFromCatalog } from './catalog.js'
import { formatCents, parseAmountToCents } from './format.js'
import { filledPriceItems } from './pricing.js'

function priceLabel(entry) {
  const cents = parseAmountToCents(entry.unitPrice)
  const price = Number.isInteger(cents) && cents >= 0 ? formatCents(cents) : entry.unitPrice || 'sin precio'
  return entry.quantity && entry.quantity !== '1' ? `${entry.quantity} × ${price}` : price
}

const sameEntry = (a, b) =>
  a.concept.trim().toLowerCase() === b.concept.trim().toLowerCase() && (a.unitPrice ?? '').trim() === (b.unitPrice ?? '').trim()

export function CatalogDialog({ open, onClose, priceItems, onAdd }) {
  const [catalog, setCatalog] = useState([])
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (open) {
      setCatalog(loadCatalog())
      setMessage(null)
    }
  }, [open])

  const savable = filledPriceItems(priceItems).filter((i) => i.concept.trim() && !catalog.some((c) => sameEntry(c, i)))

  const save = (item) => {
    const result = addToCatalog(item)
    setCatalog(result.list)
    if (!result.ok) {
      setMessage(
        {
          full: `Tu catálogo está lleno (máximo ${MAX_CATALOG_ITEMS}). Borra algún servicio para guardar otro.`,
          storage: 'No se pudo guardar en este navegador.',
        }[result.reason] ?? null,
      )
    } else setMessage(null)
  }

  const add = (entry) => {
    onAdd(entry)
    setMessage(`Añadido: ${entry.concept}`)
  }

  return (
    <Modal open={open} title="Mi catálogo de servicios" onClose={onClose} wide>
      <p className="modal__muted">
        Guarda tus servicios con su precio una vez y añádelos a cualquier propuesta con un clic.
      </p>
      {message && (
        <p className="catalog__message" role="status">
          {message}
        </p>
      )}

      <h3 className="catalog__heading">Tus servicios</h3>
      {catalog.length === 0 ? (
        <p className="modal__muted">Todavía no has guardado ningún servicio. Guárdalos desde los conceptos de esta propuesta.</p>
      ) : (
        <ul className="catalog__list">
          {catalog.map((entry) => (
            <li key={entry.id} className="catalog__item">
              <span className="catalog__concept">{entry.concept}</span>
              <span className="catalog__price">{priceLabel(entry)}</span>
              <button type="button" className="button button--ghost button--small" onClick={() => add(entry)}>
                <PlusIcon size={14} /> Añadir
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={() => setCatalog(removeFromCatalog(entry.id))}
                aria-label={`Borrar «${entry.concept}» del catálogo`}
                title="Borrar del catálogo"
              >
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {savable.length > 0 && (
        <>
          <h3 className="catalog__heading">Guardar desde esta propuesta</h3>
          <ul className="catalog__list">
            {savable.map((item) => (
              <li key={item.id} className="catalog__item">
                <span className="catalog__concept">{item.concept}</span>
                <span className="catalog__price">{priceLabel(item)}</span>
                <button type="button" className="button button--ghost button--small" onClick={() => save(item)}>
                  <BookmarkIcon size={14} /> Guardar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="modal__actions">
        <button type="button" className="button button--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
