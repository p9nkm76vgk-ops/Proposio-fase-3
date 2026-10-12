// Panel de negocio: qué has enviado, qué han abierto, qué han aceptado y
// qué propuestas conviene recordar al cliente. Se calcula con tus enlaces enviados.

import { useMemo } from 'react'
import { Modal } from './Feedback.jsx'
import { shareUrl } from './cloud.js'
import { formatCents } from './format.js'
import { FOLLOW_UP_DAYS, computeDashboard, reminderMessage, whatsappUrl } from './sharing.js'
import { formatDateTime } from './ShareDialog.jsx'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function daysAgo(iso, now) {
  const days = Math.floor((now - new Date(iso)) / (24 * 60 * 60 * 1000))
  return days <= 0 ? 'hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`
}

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  )
}

export function DashboardDialog({ open, onClose, shares, loading, locked, onOpenPlans, onOpenProposal }) {
  const now = useMemo(() => new Date(), [open]) // se actualiza cada vez que se abre
  const data = useMemo(() => computeDashboard(shares, now), [shares, now])
  const month = MONTHS[now.getMonth()]

  return (
    <Modal open={open} title="Panel de negocio" onClose={onClose} wide>
      {locked ? (
        <div className="locked-panel">
          <p>
            Con <strong>Pro</strong> verás de un vistazo lo que has enviado, lo que han abierto tus clientes, lo aceptado este
            mes y las propuestas que conviene recordar.
          </p>
          <p className="modal__muted">Los avisos cuando un cliente acepta una propuesta siguen incluidos en tu plan.</p>
          <div className="modal__actions modal__actions--start">
            <button type="button" className="button button--primary" onClick={onOpenPlans}>
              Ver planes
            </button>
          </div>
        </div>
      ) : loading && shares.length === 0 ? (
        <p className="modal__muted">Cargando…</p>
      ) : shares.length === 0 ? (
        <p className="modal__muted">
          Aún no has enviado ninguna propuesta por enlace. Usa «Enviar al cliente» debajo del formulario y aquí verás si la abren
          y la aceptan.
        </p>
      ) : (
        <div className="dashboard">
          <h3 className="dashboard__heading">En {month}</h3>
          <dl className="stats">
            <Stat label="Enviadas" value={data.month.sent} />
            <Stat label="Abiertas por primera vez" value={data.month.opened} />
            <Stat label="Aceptadas" value={data.month.accepted} />
            <Stat label="Importe aceptado" value={formatCents(data.month.acceptedCents)} hint="Total que aceptaron tus clientes" />
          </dl>
          {data.acceptanceRate !== null && (
            <p className="dashboard__rate">
              Tasa de aceptación: <strong>{data.acceptanceRate} %</strong> de tus propuestas enviadas.
            </p>
          )}

          <h3 className="dashboard__heading">
            Para recordar <span className="dashboard__count">{data.pending.length}</span>
          </h3>
          {data.pending.length === 0 ? (
            <p className="modal__muted">
              Nada pendiente: aquí aparecen las propuestas enviadas hace {FOLLOW_UP_DAYS} días o más que aún no se han aceptado.
            </p>
          ) : (
            <ul className="dash-list">
              {data.pending.map((s) => (
                <li key={s.token} className="dash-list__item">
                  <div className="dash-list__info">
                    <p className="dash-list__title">{s.title || 'Sin título'}</p>
                    <p className="dash-list__meta">
                      {s.clientName || 'Sin cliente'} · enviada {daysAgo(s.sharedAt, now)} ·{' '}
                      {s.viewCount > 0 ? `abierta ${s.viewCount === 1 ? '1 vez' : `${s.viewCount} veces`}` : 'sin abrir'}
                    </p>
                  </div>
                  <div className="dash-list__actions">
                    <a
                      className="button button--whatsapp button--small"
                      href={whatsappUrl(reminderMessage(s, shareUrl(s.token)))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Recordar por WhatsApp
                    </a>
                    <button type="button" className="button button--ghost button--small" onClick={() => onOpenProposal(s.proposalId)}>
                      Abrir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data.waiting.length > 0 && (
            <>
              <h3 className="dashboard__heading">
                Enviadas recientemente <span className="dashboard__count">{data.waiting.length}</span>
              </h3>
              <ul className="dash-list">
                {data.waiting.map((s) => (
                  <li key={s.token} className="dash-list__item">
                    <div className="dash-list__info">
                      <p className="dash-list__title">{s.title || 'Sin título'}</p>
                      <p className="dash-list__meta">
                        {s.clientName || 'Sin cliente'} · enviada {daysAgo(s.sharedAt, now)} ·{' '}
                        {s.viewCount > 0 ? `abierta, última vez ${formatDateTime(s.lastViewedAt)}` : 'sin abrir'}
                      </p>
                    </div>
                    <div className="dash-list__actions">
                      <button type="button" className="button button--ghost button--small" onClick={() => onOpenProposal(s.proposalId)}>
                        Abrir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="dashboard__heading">
            Aceptadas <span className="dashboard__count">{data.accepted.length}</span>
          </h3>
          {data.accepted.length === 0 ? (
            <p className="modal__muted">Todavía no hay propuestas aceptadas.</p>
          ) : (
            <ul className="dash-list">
              {data.accepted.slice(0, 10).map((s) => (
                <li key={s.token} className="dash-list__item">
                  <div className="dash-list__info">
                    <p className="dash-list__title">{s.title || 'Sin título'}</p>
                    <p className="dash-list__meta">
                      {s.acceptedName} · {formatDateTime(s.acceptedAt)}
                      {s.acceptedExtras.length > 0 && ` · con ${s.acceptedExtras.length === 1 ? '1 extra' : `${s.acceptedExtras.length} extras`}`}
                    </p>
                  </div>
                  {Number.isInteger(s.acceptedTotalCents) && <strong className="dash-list__amount">{formatCents(s.acceptedTotalCents)}</strong>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="modal__actions">
        <button type="button" className="button button--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
