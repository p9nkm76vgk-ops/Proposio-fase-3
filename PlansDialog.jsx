// Ventana de planes: comparar, suscribirse (Stripe Checkout) y gestionar la suscripción.
// Solo se muestra cuando los pagos están activados en proposio-config.js.

import { useEffect, useState } from 'react'
import { openCustomerPortal, startCheckout } from './cloud.js'
import { PAYMENTS } from './config.js'
import { BUSINESS_UPCOMING, PLAN_FEATURES, PLAN_LABELS, isPaidPlan } from './entitlements.js'
import { Modal } from './Feedback.jsx'
import { CheckIcon, Spinner } from './Icons.jsx'

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

/** Línea de estado de la suscripción actual, en lenguaje claro. */
export function subscriptionSummary(plan, subscription) {
  if (!isPaidPlan(plan) || !subscription) return null
  const end = subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : ''
  if (subscription.status === 'past_due') {
    return 'No se pudo cobrar la última cuota. Actualiza tu forma de pago en «Gestionar suscripción».'
  }
  if (subscription.cancelAtPeriodEnd) {
    return end ? `Cancelada: seguirás en ${PLAN_LABELS[plan]} hasta el ${end}.` : 'Cancelada al final del periodo actual.'
  }
  return end ? `Se renueva el ${end}.` : null
}

function PlanCard({ id, title, price, period, features, current, upcoming, children }) {
  return (
    <article className={`plan-card ${current ? 'plan-card--current' : ''}`} aria-labelledby={`plan-${id}`}>
      <header className="plan-card__header">
        <h3 className="plan-card__title" id={`plan-${id}`}>
          {title}
          {current && <span className="plan-card__badge">Tu plan</span>}
        </h3>
        <p className="plan-card__price">
          <strong>{price}</strong> {period && <span>{period}</span>}
        </p>
      </header>
      <ul className="plan-card__features">
        {features.map((f) => (
          <li key={f}>
            <CheckIcon size={16} /> {f}
          </li>
        ))}
      </ul>
      {upcoming?.length > 0 && (
        <p className="plan-card__upcoming">En desarrollo: {upcoming.join(' y ').toLowerCase()}.</p>
      )}
      <div className="plan-card__action">{children}</div>
    </article>
  )
}

export function PlansDialog({ open, onClose, account, plan, subscription, onLogin }) {
  const [busy, setBusy] = useState(null) // 'pro' | 'business' | 'portal'
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setBusy(null)
      setError(null)
    }
  }, [open])

  const go = async (target) => {
    setBusy(target)
    setError(null)
    try {
      const url = target === 'portal' ? await openCustomerPortal() : await startCheckout(target)
      window.location.assign(url) // página segura de Stripe
    } catch (err) {
      setError(err?.userMessage ?? 'No se pudo abrir el sistema de pagos.')
      setBusy(null)
    }
  }

  const paid = isPaidPlan(plan)
  const summary = subscriptionSummary(plan, subscription)

  const actionFor = (target) => {
    if (!account) {
      return (
        <button type="button" className="button button--primary" onClick={onLogin}>
          Entra para suscribirte
        </button>
      )
    }
    if (paid) {
      return plan === target ? (
        <button type="button" className="button button--ghost" onClick={() => go('portal')} disabled={busy !== null}>
          {busy === 'portal' && <Spinner size={16} />} Gestionar suscripción
        </button>
      ) : (
        <button type="button" className="button button--ghost" onClick={() => go('portal')} disabled={busy !== null}>
          Cambiar a {PLAN_LABELS[target]}
        </button>
      )
    }
    return (
      <button type="button" className="button button--primary" onClick={() => go(target)} disabled={busy !== null}>
        {busy === target && <Spinner size={16} />}
        {busy === target ? 'Abriendo pago…' : `Suscribirme a ${PLAN_LABELS[target]}`}
      </button>
    )
  }

  return (
    <Modal open={open} title="Planes de proposio" onClose={onClose} wide>
      {summary && <p className="plans__summary">{summary}</p>}
      <div className={`plans ${PAYMENTS.business.enabled ? 'plans--three' : ''}`}>
        <PlanCard id="free" title="Gratis" price="0 €" period="" features={PLAN_FEATURES.free} current={plan === 'free'}>
          {plan === 'free' ? <p className="plan-card__note">Es tu plan actual.</p> : <p className="plan-card__note">Al cancelar vuelves a este plan.</p>}
        </PlanCard>
        <PlanCard
          id="pro"
          title="Pro"
          price={PAYMENTS.pro.price}
          period={PAYMENTS.pro.period}
          features={PLAN_FEATURES.pro}
          current={plan === 'pro'}
        >
          {actionFor('pro')}
        </PlanCard>
        {PAYMENTS.business.enabled && (
          <PlanCard
            id="business"
            title="Business"
            price={PAYMENTS.business.price}
            period={PAYMENTS.business.period}
            features={PLAN_FEATURES.business}
            upcoming={BUSINESS_UPCOMING}
            current={plan === 'business'}
          >
            {actionFor('business')}
          </PlanCard>
        )}
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <p className="modal__muted plans__legal">
        {PAYMENTS.priceNote ? `${PAYMENTS.priceNote}. ` : ''}Pago seguro con Stripe: proposio no ve ni guarda los datos de tu
        tarjeta. Puedes cancelar cuando quieras desde «Gestionar suscripción»; seguirás en tu plan hasta el final del periodo
        pagado. Consulta las{' '}
        <a href="condiciones.html" target="_blank" rel="noopener">
          condiciones
        </a>
        .
      </p>
      <div className="modal__actions">
        <button type="button" className="button button--ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
