// Ventanas de cuenta: entrar con enlace por email, lista de propuestas guardadas
// y gestión de la cuenta (cerrar sesión y eliminar la cuenta con todos sus datos).

import { useEffect, useState } from 'react'
import { deleteAccount, listProposals, sendMagicLink, signInWithGoogle } from './cloud.js'
import { GOOGLE_LOGIN } from './config.js'
import { Modal } from './Feedback.jsx'
import { Spinner, TrashIcon } from './Icons.jsx'
import { PLAN_LABELS } from './entitlements.js'
import { subscriptionSummary } from './PlansDialog.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}

/** Logotipo «G» de Google (requerido por sus normas de marca en el botón de acceso). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

// ─── Entrar ─────────────────────────────────────────────────────────────────

export function LoginDialog({ open, onClose, intro = '' }) {
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

  const google = async () => {
    if (!accepted) {
      setError('Para crear o usar tu cuenta tienes que aceptar la política de privacidad.')
      return
    }
    setStatus('google')
    setError(null)
    try {
      await signInWithGoogle() // la página se va a Google; al volver, la sesión ya está iniciada
    } catch (err) {
      setStatus('idle')
      setError(err?.userMessage ?? 'No se pudo abrir el acceso con Google.')
    }
  }

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
          {intro && <p className="login-form__intro">{intro}</p>}
          <p>
            {GOOGLE_LOGIN ? 'Entra con tu cuenta de Google o te enviamos un enlace por email.' : 'Te enviaremos un enlace para entrar.'}{' '}
            No necesitas contraseña. Si es la primera vez, se crea tu cuenta.
          </p>
          <p className="modal__muted">
            Con una cuenta, tus propuestas, tu diseño y tus textos guardados quedan disponibles en cualquier dispositivo.
          </p>
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
          {GOOGLE_LOGIN && (
            <>
              <button type="button" className="button button--google" onClick={google} disabled={status === 'google' || status === 'sending'}>
                {status === 'google' ? <Spinner size={16} /> : <GoogleMark />}
                {status === 'google' ? 'Abriendo Google…' : 'Continuar con Google'}
              </button>
              <p className="login-form__or">
                <span>o con un enlace a tu email</span>
              </p>
            </>
          )}
          <div className="field">
            <label className="field__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              data-autofocus={GOOGLE_LOGIN ? undefined : true}
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

export function ProposalsDialog({
  open,
  onClose,
  currentId,
  onOpenProposal,
  onDeleteProposal,
  refreshKey,
  locked = false,
  onOpenPlans,
  shares = [],
  viewTracking = false,
}) {
  const shareById = new Map(shares.map((sh) => [sh.proposalId, sh]))
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (!open || locked) return undefined
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
  }, [open, refreshKey, locked])

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
      {locked && (
        <div className="locked-panel">
          <p>
            El historial de propuestas forma parte del plan <strong>Pro</strong>. Tu propuesta actual se sigue guardando en tu
            cuenta.
          </p>
          <div className="modal__actions modal__actions--start">
            <button type="button" className="button button--primary" onClick={onOpenPlans}>
              Ver planes
            </button>
          </div>
        </div>
      )}
      {!locked && error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      {!locked && !items && !error && (
        <p className="modal__muted loading-line">
          <Spinner size={16} /> Cargando…
        </p>
      )}
      {!locked && items?.length === 0 && (
        <p className="modal__muted">
          Todavía no tienes propuestas guardadas. Se guardan solas en cuanto empiezas a escribir una.
        </p>
      )}
      {!locked && items?.length > 0 && (
        <ul className="proposal-list">
          {items.map((p) => (
            <li key={p.id} className={`proposal-list__item ${p.id === currentId ? 'proposal-list__item--current' : ''}`}>
              <div className="proposal-list__info">
                <p className="proposal-list__title">
                  {p.title || 'Sin título'}
                  <ShareBadge share={shareById.get(p.id)} viewTracking={viewTracking} />
                </p>
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

/** Etiqueta de estado de una propuesta enviada por enlace. */
function ShareBadge({ share, viewTracking }) {
  if (!share) return null
  let kind = 'sent'
  let label = 'Enviada'
  if (share.status === 'accepted') {
    kind = 'accepted'
    label = 'Aceptada'
  } else if (share.revoked) {
    kind = 'off'
    label = 'Enlace desactivado'
  } else if (viewTracking && share.viewCount > 0) {
    kind = 'viewed'
    label = 'Vista'
  }
  return <span className={`status-badge status-badge--${kind}`}>{label}</span>
}

// ─── Mi cuenta ──────────────────────────────────────────────────────────────

export function AccountDialog({ open, onClose, account, onSignOut, onAccountDeleted, plan = 'free', subscription = null, onOpenPlans }) {
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
      {onOpenPlans && (
        <div className="account-plan">
          <p>
            Tu plan: <strong>{PLAN_LABELS[plan]}</strong>
          </p>
          {subscriptionSummary(plan, subscription) && <p className="modal__muted">{subscriptionSummary(plan, subscription)}</p>}
          <button type="button" className="button button--ghost button--small" onClick={onOpenPlans}>
            {plan === 'free' ? 'Ver planes' : 'Planes y suscripción'}
          </button>
        </div>
      )}
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
