// Ventanas de cuenta: entrar con enlace por email, lista de propuestas guardadas
// y gestión de la cuenta (cerrar sesión y eliminar la cuenta con todos sus datos).

import { useEffect, useState } from 'react'
import { deleteAccount, listProposals, sendMagicLink } from './cloud.js'
import { Modal } from './Feedback.jsx'
import { Spinner, TrashIcon } from './Icons.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}

// ─── Entrar ─────────────────────────────────────────────────────────────────

export function LoginDialog({ open, onClose }) {
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setStatus('idle')
      setError(null)
    }
  }, [open])

  const submit = async (event) => {
    event.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError('Escribe un email válido, por ejemplo nombre@dominio.com.')
      return
    }
    if (!accepted) {
      setError('Para crear o usar tu cuenta tienes que aceptar la política de privacidad.')
      return
    }
    setStatus('sending')
    setError(null)
    try {
      await sendMagicLink(value)
      setStatus('sent')
    } catch (err) {
      setStatus('idle')
      setError(err?.userMessage ?? 'No se pudo enviar el enlace. Inténtalo de nuevo.')
    }
  }

  return (
    <Modal open={open} title={status === 'sent' ? 'Revisa tu correo' : 'Entrar en proposio'} onClose={onClose}>
      {status === 'sent' ? (
        <>
          <p>
            Hemos enviado un enlace de acceso a <strong>{email.trim()}</strong>. Ábrelo desde este mismo navegador para
            entrar.
          </p>
          <p className="modal__muted">Si no lo ves en unos minutos, revisa la carpeta de spam.</p>
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={() => setStatus('idle')}>
              Usar otro email
            </button>
            <button type="button" className="button button--primary" onClick={onClose}>
              Entendido
            </button>
          </div>
        </>
      ) : (
        <form className="login-form" onSubmit={submit} noValidate>
          <p>Te enviaremos un enlace para entrar. No necesitas contraseña. Si es la primera vez, se crea tu cuenta.</p>
          <p className="modal__muted">
            Con una cuenta, tus propuestas, tu diseño y tus textos guardados quedan disponibles en cualquier dispositivo.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              data-autofocus
              className="field__control"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error && !EMAIL_RE.test(email.trim()) ? 'true' : undefined}
            />
          </div>
          <label className="checkbox">
            <input id="login-privacy" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              He leído y acepto la{' '}
              <a href="privacidad.html" target="_blank" rel="noopener">
                política de privacidad
              </a>
              .
            </span>
          </label>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={status === 'sending'}>
              {status === 'sending' && <Spinner size={16} />}
              {status === 'sending' ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ─── Mis propuestas ─────────────────────────────────────────────────────────

export function ProposalsDialog({ open, onClose, currentId, onOpenProposal, onDeleteProposal, refreshKey }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setItems(null)
    setError(null)
    setConfirmId(null)
    listProposals()
      .then((list) => !cancelled && setItems(list))
      .catch((err) => !cancelled && setError(err?.userMessage ?? 'No se pudieron cargar tus propuestas.'))
    return () => {
      cancelled = true
    }
  }, [open, refreshKey])

  const remove = async (id) => {
    setBusyId(id)
    try {
      await onDeleteProposal(id)
      setItems((list) => list.filter((p) => p.id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(err?.userMessage ?? 'No se pudo eliminar la propuesta.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal open={open} title="Mis propuestas" onClose={onClose} wide>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && (
        <p className="modal__muted loading-line">
          <Spinner size={16} /> Cargando…
        </p>
      )}
      {items?.length === 0 && (
        <p className="modal__muted">
          Todavía no tienes propuestas guardadas. Se guardan solas en cuanto empiezas a escribir una.
        </p>
      )}
      {items?.length > 0 && (
        <ul className="proposal-list">
          {items.map((p) => (
            <li key={p.id} className={`proposal-list__item ${p.id === currentId ? 'proposal-list__item--current' : ''}`}>
              <div className="proposal-list__info">
                <p className="proposal-list__title">{p.title || 'Sin título'}</p>
                <p className="proposal-list__meta">
                  {p.clientName || 'Sin cliente'} · {formatDateTime(p.updatedAt)}
                </p>
              </div>
              {confirmId === p.id ? (
                <div className="proposal-list__actions">
                  <span className="proposal-list__confirm">¿Eliminar?</span>
                  <button type="button" className="button button--ghost button--small" onClick={() => setConfirmId(null)}>
                    No
                  </button>
                  <button type="button" className="button button--danger button--small" onClick={() => remove(p.id)} disabled={busyId === p.id}>
                    {busyId === p.id ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                </div>
              ) : (
                <div className="proposal-list__actions">
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => onOpenProposal(p.id)}
                    disabled={p.id === currentId}
                  >
                    {p.id === currentId ? 'Abierta' : 'Abrir'}
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => setConfirmId(p.id)}
                    aria-label={`Eliminar «${p.title || 'Sin título'}»`}
                    title="Eliminar"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="modal__actions">
        <button type="button" className="button button--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

// ─── Mi cuenta ──────────────────────────────────────────────────────────────

export function AccountDialog({ open, onClose, account, onSignOut, onAccountDeleted }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(null) // 'signout' | 'delete'
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setConfirm(false)
      setError(null)
      setBusy(null)
    }
  }, [open])

  const signOut = async () => {
    setBusy('signout')
    setError(null)
    try {
      await onSignOut()
    } catch (err) {
      setError(err?.userMessage ?? 'No se pudo cerrar la sesión.')
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await deleteAccount()
      onAccountDeleted()
    } catch (err) {
      setError(err?.userMessage ?? 'No se pudo eliminar la cuenta.')
      setBusy(null)
    }
  }

  return (
    <Modal open={open} title="Mi cuenta" onClose={onClose}>
      <p>
        Has entrado como <strong>{account?.email}</strong>.
      </p>
      <p className="modal__muted">Tus propuestas, tu diseño y tus textos guardados se guardan en tu cuenta.</p>
      <div className="modal__actions modal__actions--start">
        <button type="button" className="button button--ghost" onClick={signOut} disabled={busy !== null}>
          {busy === 'signout' ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>

      <div className="danger-zone">
        <h3 className="danger-zone__title">Eliminar la cuenta</h3>
        <p>Se borrarán para siempre tu cuenta, todas tus propuestas, tu diseño y tus textos guardados.</p>
        <label className="checkbox">
          <input id="confirm-delete-account" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          <span>Entiendo que no se puede deshacer.</span>
        </label>
        <button type="button" className="button button--danger" onClick={remove} disabled={!confirm || busy !== null}>
          {busy === 'delete' ? 'Eliminando…' : 'Eliminar mi cuenta y mis datos'}
        </button>
      </div>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="button button--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
