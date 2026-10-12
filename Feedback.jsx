// Componentes de respuesta al usuario: aviso flotante (toast) y ventana modal.

import { useEffect, useRef } from 'react'
import { AlertIcon, CheckIcon, CloseIcon } from './Icons.jsx'

/** Aviso temporal. Se anuncia a lectores de pantalla mediante aria-live. */
export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(onClose, toast.type === 'error' ? 6000 : 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.type === 'error' ? <AlertIcon /> : <CheckIcon />}
          <span>{toast.message}</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar aviso">
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

/** Ventana modal accesible: enfoca el primer botón, se cierra con Escape y devuelve el foco. */
export function Modal({ open, title, children, onClose, actions, wide = false }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    dialogRef.current?.querySelector('[data-autofocus], button')?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        // Mantiene el foco dentro de la ventana
        const focusables = dialogRef.current?.querySelectorAll('button, a[href], input, textarea, select')
        if (!focusables?.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}>
        <h2 id="modal-title" className="modal__title">
          {title}
        </h2>
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  )
}
