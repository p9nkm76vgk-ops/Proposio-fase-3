// Ventana «Enviar al cliente»: enlace para copiar o compartir por WhatsApp o correo,
// estado de la propuesta (enviada, abierta, aceptada) y opciones del enlace.

import { useEffect, useRef, useState } from 'react'
import { Modal } from './Feedback.jsx'
import { CheckIcon, CopyIcon, Spinner } from './Icons.jsx'
import { shareUrl } from './cloud.js'
import { formatCents } from './format.js'
import { isShareOutdated, mailtoUrl, shareMessage, whatsappUrl } from './sharing.js'

export function formatDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Frase de estado de un enlace. viewTracking: ¿puede ver el usuario si se abrió? */
export function shareStatusText(share, viewTracking) {
  if (!share) return ''
  if (share.status === 'accepted') return `Aceptada por ${share.acceptedName} · ${formatDateTime(share.acceptedAt)}`
  if (share.revoked) return 'Enlace desactivado: tu cliente no puede abrirlo.'
  if (!viewTracking) return `Enviada · ${formatDateTime(share.sharedAt)}`
  if (share.viewCount === 0) return `Enviada · ${formatDateTime(share.sharedAt)} · Todavía no la ha abierto`
  const times = share.viewCount === 1 ? '1 vez' : `${share.viewCount} veces`
  return `Abierta ${times} · última vez ${formatDateTime(share.lastViewedAt)}`
}

export function ShareDialog({ open, onClose, share, proposal, busy, error, entitlements, onUpdate, onSetActive, onOpenPlans }) {
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const url = share ? shareUrl(share.token) : ''
  const message = share ? shareMessage(proposal, url) : ''
  const accepted = share?.status === 'accepted'
  const outdated = share && !accepted && isShareOutdated(share, proposal) === true
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Sin permiso para el portapapeles: se selecciona el texto para copiarlo a mano
      inputRef.current?.select()
    }
  }

  const nativeShare = () => {
    navigator.share({ title: proposal.project?.title || 'Propuesta', text: message.replace(url, '').trim(), url }).catch(() => {})
  }

  return (
    <Modal open={open} title="Enviar al cliente" onClose={onClose} wide>
      {!share && busy && (
        <p className="modal__muted loading-line">
          <Spinner size={16} /> Preparando el enlace…
        </p>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      {share && (
        <div className="share">
          <p className={`share__status share__status--${accepted ? 'accepted' : share.revoked ? 'off' : 'sent'}`}>
            {accepted && <CheckIcon size={16} />}
            {shareStatusText(share, entitlements.viewTracking)}
          </p>

          {accepted && (
            <div className="share__notice share__notice--success">
              {Number.isInteger(share.acceptedTotalCents) && (
                <p>
                  Total aceptado: <strong>{formatCents(share.acceptedTotalCents)}</strong>
                </p>
              )}
              {share.acceptedExtras.length > 0 && (
                <p>Extras elegidos: {share.acceptedExtras.map((e) => `${e.concept} (+${formatCents(e.cents)})`).join(', ')}</p>
              )}
              <p className="share__fine">
                Lo aceptado ya no se puede cambiar. Si necesitas otra versión, usa «Duplicar» y envía la copia.
              </p>
            </div>
          )}

          {outdated && (
            <div className="share__notice">
              <p>Has hecho cambios desde que la enviaste. Tu cliente sigue viendo la versión anterior.</p>
              <button type="button" className="button button--primary button--small" onClick={onUpdate} disabled={busy}>
                {busy ? 'Actualizando…' : 'Actualizar enlace con los cambios'}
              </button>
            </div>
          )}

          {!share.revoked && (
            <>
              <label className="field" htmlFor="share-url">
                <span className="field__label">Enlace de la propuesta</span>
                <span className="share__link">
                  <input id="share-url" ref={inputRef} className="field__control" type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
                  <button type="button" className="button button--ghost" onClick={copy}>
                    {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </span>
              </label>

              <div className="share__channels">
                <a className="button button--whatsapp" href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">
                  Enviar por WhatsApp
                </a>
                <a className="button button--ghost" href={mailtoUrl(proposal, message)}>
                  Enviar por correo
                </a>
                {canNativeShare && (
                  <button type="button" className="button button--ghost" onClick={nativeShare}>
                    Más opciones…
                  </button>
                )}
              </div>
              <p className="share__fine">
                Tu cliente podrá ver la propuesta, descargarla en PDF y aceptarla con su nombre, sin crear ninguna cuenta.
                {!accepted && ' Aceptar no realiza ningún pago.'}
              </p>
            </>
          )}

          {!entitlements.viewTracking && !accepted && onOpenPlans && (
            <p className="share__upsell">
              Con <strong>Pro</strong> sabrás si tu cliente ha abierto la propuesta y cuándo.{' '}
              <button type="button" className="link-button" onClick={onOpenPlans}>
                Ver planes
              </button>
            </p>
          )}
        </div>
      )}

      <div className="modal__actions">
        {share && !accepted && (
          <button type="button" className="button button--ghost share__toggle" onClick={() => onSetActive(share.revoked)} disabled={busy}>
            {share.revoked ? 'Volver a activar el enlace' : 'Desactivar enlace'}
          </button>
        )}
        <button type="button" className="button button--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
