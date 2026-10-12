// Página que ve el CLIENTE al abrir el enlace de una propuesta (ver.html?p=...).
// No necesita cuenta: el enlace lleva un código secreto (token) y el servidor
// (view_shared_proposal / accept_shared_proposal en supabase.sql) solo devuelve
// la propuesta a quien lo conoce. El total al aceptar lo calcula el servidor.

import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrandMark } from './BrandMark.jsx'
import { AlertIcon, CheckIcon, DownloadIcon, Spinner } from './Icons.jsx'
import { ProposalPreview } from './ProposalPreview.jsx'
import * as cloud from './cloud.js'
import { buildDocument } from './document.js'
import { addDays, formatCents, formatLongDate, formatPercent, parseISODate } from './format.js'
import { downloadProposalPdf } from './pdf.js'
import { downloadAcceptancePdf } from './acceptance.js'
import { totalWithExtras } from './pricing.js'
import { normalizeProposal } from './proposal.js'
import './styles.css'

const TOKEN_PATTERN = /^[0-9a-f]{32}$/

// La primera carga se hace una sola vez aunque React monte el componente dos veces
// (modo de desarrollo), para no contar dos visitas.
let firstLoad = null
function loadShared(token, attempt) {
  if (attempt > 0) return cloud.viewSharedProposal(token)
  firstLoad ??= cloud.viewSharedProposal(token)
  return firstLoad
}

/** Texto que acompaña al total según cómo indicó los impuestos el profesional. */
function taxNote(pricing, taxLabel) {
  if (typeof pricing?.tax_rate === 'number') return `${taxLabel} (${formatPercent(pricing.tax_rate)}) incluido en el total`
  if (pricing?.tax_mode === 'included') return 'Impuestos incluidos'
  if (pricing?.tax_mode === 'excluded') return 'Impuestos no incluidos'
  return 'Tratamiento de impuestos no especificado'
}

/** Fecha hasta la que es válida la propuesta (o null si no se indicó). */
function validUntil(proposal) {
  const date = parseISODate(proposal.project.date)
  const days = Number(proposal.project.validityDays.trim())
  return date && Number.isInteger(days) && days > 0 ? addDays(date, days) : null
}

function ViewerPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('p') ?? '', [])
  const [state, setState] = useState({ phase: 'loading' }) // loading | missing | error | ready
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!cloud.cloudEnabled) {
      setState({ phase: 'error', message: 'Este enlace no se puede abrir porque el servicio no está configurado.' })
      return undefined
    }
    if (!TOKEN_PATTERN.test(token)) {
      setState({ phase: 'missing' })
      return undefined
    }
    let cancelled = false
    setState({ phase: 'loading' })
    loadShared(token, reloadKey)
      .then((data) => {
        if (cancelled) return
        const proposal = data ? normalizeProposal(data.snapshot) : null
        if (!proposal) {
          setState({ phase: 'missing' })
          return
        }
        setState({ phase: 'ready', proposal, pricing: data.pricing ?? {}, share: data })
      })
      .catch((err) => !cancelled && setState({ phase: 'error', message: err.userMessage ?? 'No se pudo cargar la propuesta.' }))
    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  return (
    <div className="viewer">
      {state.phase === 'loading' && (
        <div className="viewer__center" role="status">
          <Spinner size={26} />
          <p>Cargando la propuesta…</p>
        </div>
      )}
      {state.phase === 'missing' && (
        <div className="viewer__center">
          <h1>Esta propuesta no está disponible</h1>
          <p>El enlace no es correcto o quien te lo envió lo ha desactivado. Pídele que te lo vuelva a enviar.</p>
        </div>
      )}
      {state.phase === 'error' && (
        <div className="viewer__center">
          <h1>No se pudo abrir la propuesta</h1>
          <p>{state.message}</p>
          <button type="button" className="button button--primary" onClick={() => setReloadKey((k) => k + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {state.phase === 'ready' && (
        <SharedProposal
          token={token}
          proposal={state.proposal}
          pricing={state.pricing}
          initialShare={state.share}
        />
      )}
      <footer className="viewer__footer">
        <a href="./" className="viewer__made-with">
          <BrandMark size={20} />
          <span>
            Creado con <strong>proposio</strong> · Crea tus propuestas gratis
          </span>
        </a>
        <p className="viewer__legal-note">
          Al abrir esta propuesta se registran el número de visitas y sus fechas para informar a quien te la envió. Si la
          aceptas, se guardan el nombre que escribas, la fecha y los extras elegidos.
        </p>
        <nav className="viewer__legal" aria-label="Información legal">
          <a href="aviso-legal.html">Aviso legal</a>
          <a href="privacidad.html#clientes">Política de Privacidad</a>
          <a href="condiciones.html">Condiciones de Uso</a>
          <a href="cookies.html">Política de cookies</a>
        </nav>
      </footer>
    </div>
  )
}

function SharedProposal({ token, proposal, pricing, initialShare }) {
  const model = useMemo(() => buildDocument(proposal), [proposal])
  const [share, setShare] = useState(initialShare)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const professional = model.professional.name || 'El profesional'
  const expiry = validUntil(proposal)
  const expired = expiry && expiry < new Date(new Date().toDateString())

  useEffect(() => {
    document.title = model.title ? `${model.title} · Propuesta` : 'Propuesta'
  }, [model.title])

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadProposalPdf(proposal)
    } catch (err) {
      setDownloadError(err?.userMessage ?? 'No se pudo generar el PDF. Inténtalo de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <header className="viewer__bar">
        <div className="viewer__bar-inner">
          <p className="viewer__from">
            Propuesta de <strong>{professional}</strong>
            {model.client.name && (
              <>
                {' '}
                para <strong>{model.client.name}</strong>
              </>
            )}
          </p>
          <div className="viewer__actions">
            <button type="button" className="button button--ghost button--small" onClick={handleDownload} disabled={downloading} aria-label="Descargar PDF">
              {downloading ? <Spinner size={16} /> : <DownloadIcon size={16} />}
              {downloading ? (
                'Generando…'
              ) : (
                <span>
                  <span className="viewer__pdf-long">Descargar </span>PDF
                </span>
              )}
            </button>
            {share.status !== 'accepted' && (
              <a className="button button--primary button--small viewer__jump" href="#aceptar">
                Aceptar
              </a>
            )}
          </div>
        </div>
      </header>
      {downloadError && (
        <p className="viewer__alert viewer__alert--error" role="alert">
          <AlertIcon size={16} /> {downloadError}
        </p>
      )}

      <main className="viewer__layout">
        <div className="viewer__doc preview-frame">
          <ProposalPreview model={model} />
        </div>
        <aside className="viewer__side" id="aceptar" aria-label="Aceptar la propuesta">
          {share.status === 'accepted' ? (
            <AcceptedCard
              share={share}
              professional={professional}
              contact={model.professional.contact}
              onDownloadProof={() =>
                downloadAcceptancePdf(
                  proposal,
                  {
                    name: share.accepted_name,
                    acceptedAt: share.accepted_at,
                    extras: share.accepted_extras,
                    totalCents: share.accepted_total_cents,
                    sharedAt: share.shared_at,
                    token,
                  },
                  pricing,
                  initialShare.snapshot,
                )
              }
            />
          ) : (
            <AcceptCard
              token={token}
              pricing={pricing}
              taxLabel={proposal.tax.label || 'IVA'}
              professional={professional}
              version={share.shared_at}
              expiry={expiry}
              expired={expired}
              onAccepted={(result) => setShare((prev) => ({ ...prev, ...result }))}
            />
          )}
        </aside>
      </main>
    </>
  )
}

function AcceptCard({ token, pricing, taxLabel, professional, version, expiry, expired, onAccepted }) {
  const extras = Array.isArray(pricing.extras) ? pricing.extras : []
  const [selected, setSelected] = useState([])
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [outdated, setOutdated] = useState(false)
  const hasPricing = Number.isInteger(pricing.base_subtotal)
  const totals = hasPricing ? totalWithExtras(pricing, selected) : null

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError('Escribe tu nombre completo para aceptar.')
      return
    }
    if (!agree) {
      setError('Marca la casilla para confirmar que aceptas la propuesta.')
      return
    }
    setSending(true)
    setError('')
    try {
      const result = await cloud.acceptSharedProposal(token, name.trim(), selected, version)
      onAccepted(result)
    } catch (err) {
      setOutdated(Boolean(err.outdated))
      setError(err.userMessage ?? 'No se pudo aceptar la propuesta. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="viewer-card" onSubmit={handleSubmit} noValidate>
      <h2 className="viewer-card__title">¿Te encaja la propuesta?</h2>
      {expiry && (
        <p className={`viewer-card__note ${expired ? 'viewer-card__note--warning' : ''}`}>
          {expired
            ? `La validez indicada terminó el ${formatLongDate(expiry)}. Puedes aceptarla igualmente; ${professional} confirmará si se mantienen las condiciones.`
            : `Válida hasta el ${formatLongDate(expiry)}.`}
        </p>
      )}

      {extras.length > 0 && (
        <fieldset className="viewer-extras">
          <legend>Extras opcionales</legend>
          {extras.map((extra) => (
            <label key={extra.id} className="checkbox viewer-extras__item">
              <input type="checkbox" checked={selected.includes(extra.id)} onChange={() => toggle(extra.id)} />
              <span className="viewer-extras__concept">{extra.concept}</span>
              <span className="viewer-extras__price">+{formatCents(extra.cents)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {totals && (
        <div className="viewer-total">
          <span>Total{selected.length > 0 ? ' con extras' : ''}</span>
          <strong>{formatCents(totals.total)}</strong>
          <small>{taxNote(pricing, taxLabel)}</small>
        </div>
      )}

      <label className="field" htmlFor="accept-name">
        <span className="field__label">Tu nombre completo</span>
        <input
          id="accept-name"
          className="field__control"
          type="text"
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>He leído la propuesta y la acepto{selected.length > 0 ? ' con los extras marcados' : ''}.</span>
      </label>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      {outdated && (
        <button type="button" className="button button--ghost" onClick={() => window.location.reload()}>
          Ver la versión nueva
        </button>
      )}

      <button type="submit" className="button button--primary button--large" disabled={sending}>
        {sending ? 'Enviando…' : 'Aceptar propuesta'}
      </button>
      <p className="viewer-card__fine">
        {professional} verá tu nombre, la fecha y los extras elegidos. Aceptar no realiza ningún pago: los siguientes pasos
        son los que indica la propuesta.
      </p>
    </form>
  )
}

function AcceptedCard({ share, professional, contact, onDownloadProof }) {
  const [busy, setBusy] = useState(false)
  const [proofError, setProofError] = useState('')
  const downloadProof = async () => {
    setBusy(true)
    setProofError('')
    try {
      await onDownloadProof()
    } catch (err) {
      setProofError(err?.userMessage ?? 'No se pudo generar el justificante. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  const acceptedAt = share.accepted_at ? new Date(share.accepted_at) : null
  const extras = Array.isArray(share.accepted_extras) ? share.accepted_extras : []
  return (
    <div className="viewer-card viewer-card--accepted" role="status">
      <p className="viewer-card__badge">
        <CheckIcon size={16} /> Propuesta aceptada
      </p>
      <p>
        Aceptada por <strong>{share.accepted_name}</strong>
        {acceptedAt && !Number.isNaN(acceptedAt.getTime()) && <> el {formatLongDate(acceptedAt)}</>}.
      </p>
      {extras.length > 0 && (
        <ul className="viewer-card__extras">
          {extras.map((e) => (
            <li key={e.id}>
              {e.concept} <span>+{formatCents(e.cents)}</span>
            </li>
          ))}
        </ul>
      )}
      {Number.isInteger(share.accepted_total_cents) && (
        <div className="viewer-total">
          <span>Total acordado</span>
          <strong>{formatCents(share.accepted_total_cents)}</strong>
        </div>
      )}
      <button type="button" className="button button--ghost" onClick={downloadProof} disabled={busy}>
        {busy ? <Spinner size={16} /> : <DownloadIcon size={16} />}
        {busy ? 'Generando…' : 'Descargar justificante de aceptación'}
      </button>
      {proofError && (
        <p className="field__error" role="alert">
          {proofError}
        </p>
      )}
      <p className="viewer-card__fine">
        {professional} ya puede ver que la has aceptado. Sigue los próximos pasos indicados en la propuesta
        {contact ? ` o contacta con: ${contact}` : ''}.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ViewerPage />
  </StrictMode>,
)
