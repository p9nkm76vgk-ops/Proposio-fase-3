// Conceptos (cantidad × precio), descuento opcional y tratamiento de impuestos.
// Los totales se calculan en vivo con la misma función que usa el PDF.

import { useEffect, useState } from 'react'
import { formatCents, formatPercent, parseAmountToCents } from './format.js'
import { computeTotals, parseQuantity } from './pricing.js'
import { DISCOUNT_MODES, TAX_MODES, createPriceItem } from './proposal.js'
import { LIMITS, fieldIdFromPath } from './validation.js'
import { FormField } from './FormField.jsx'
import { PlusIcon, TrashIcon } from './Icons.jsx'

/** Importe de una línea para mostrarlo mientras se escribe (o un guion si aún no es válido). */
function lineTotal(item) {
  const unit = parseAmountToCents(item.unitPrice)
  const qty = parseQuantity(item.quantity)
  if (unit === null || Number.isNaN(unit) || Number.isNaN(qty)) return '—'
  return formatCents(Math.round((unit * qty) / 100))
}

function CellInput({ path, label, errorFor, onBlur, className = '', ...props }) {
  const id = fieldIdFromPath(path)
  const error = errorFor(path)
  return (
    <div className={`price-editor__cell ${className}`}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__control"
        onBlur={() => onBlur(path)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function PricingEditor({ proposal, onItemsChange, onDiscountChange, onTaxChange, errorFor, onBlur }) {
  const items = proposal.priceItems
  const [focusId, setFocusId] = useState(null)
  const totals = computeTotals(proposal)
  const listError = errorFor('priceItems')
  const taxError = errorFor('tax.mode')

  useEffect(() => {
    if (!focusId) return
    document.getElementById(fieldIdFromPath(`priceItems.${focusId}.concept`))?.focus()
    setFocusId(null)
  }, [focusId])

  const update = (id, key, value) => onItemsChange(items.map((i) => (i.id === id ? { ...i, [key]: value } : i)))

  const add = () => {
    if (items.length >= LIMITS.maxListItems) return
    const item = createPriceItem()
    onItemsChange([...items, item])
    setFocusId(item.id)
  }

  const remove = (id) => {
    const next = items.filter((i) => i.id !== id)
    onItemsChange(next.length ? next : [createPriceItem()])
  }

  return (
    <>
      <div className={`price-editor ${listError ? 'field--error' : ''}`}>
        <div className="price-editor__head" aria-hidden="true">
          <span>Concepto</span>
          <span>Cant.</span>
          <span>Precio (€)</span>
          <span>Importe</span>
          <span />
        </div>
        <ul className="price-editor__rows" id={fieldIdFromPath('priceItems')} tabIndex={-1}>
          {items.map((item, index) => (
            <li key={item.id} className="price-editor__row">
              <CellInput
                path={`priceItems.${item.id}.concept`}
                label={`Concepto ${index + 1}`}
                className="price-editor__cell--concept"
                value={item.concept}
                maxLength={LIMITS.concept}
                placeholder="Ej.: Diseño de la página de inicio"
                onChange={(e) => update(item.id, 'concept', e.target.value)}
                errorFor={errorFor}
                onBlur={onBlur}
              />
              <CellInput
                path={`priceItems.${item.id}.quantity`}
                label={`Cantidad del concepto ${index + 1}`}
                className="price-editor__cell--qty"
                value={item.quantity}
                inputMode="decimal"
                maxLength={LIMITS.quantity}
                placeholder="1"
                onChange={(e) => update(item.id, 'quantity', e.target.value)}
                errorFor={errorFor}
                onBlur={onBlur}
              />
              <CellInput
                path={`priceItems.${item.id}.unitPrice`}
                label={`Precio unitario del concepto ${index + 1}, en euros`}
                className="price-editor__cell--price"
                value={item.unitPrice}
                inputMode="decimal"
                maxLength={LIMITS.amount}
                placeholder="0,00"
                onChange={(e) => update(item.id, 'unitPrice', e.target.value)}
                errorFor={errorFor}
                onBlur={onBlur}
              />
              <output className="price-editor__total" aria-label={`Importe del concepto ${index + 1}`}>
                {lineTotal(item)}
              </output>
              <button
                type="button"
                className="icon-button icon-button--danger price-editor__remove"
                onClick={() => remove(item.id)}
                aria-label={`Eliminar concepto ${index + 1}`}
                title="Eliminar"
              >
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
        {listError && <p className="field__error">{listError}</p>}
        <p className="field__hint">La cantidad es opcional (por defecto 1). Usa decimales para horas: 2,5.</p>
        <button type="button" className="button button--ghost button--small" onClick={add} disabled={items.length >= LIMITS.maxListItems}>
          <PlusIcon size={16} /> Añadir concepto
        </button>
      </div>

      <fieldset className="discount" id={fieldIdFromPath('discount.mode')} tabIndex={-1}>
        <legend className="field__label">
          Descuento <span className="field__optional">(opcional)</span>
        </legend>
        <div className="segmented" role="radiogroup" aria-label="Tipo de descuento">
          {DISCOUNT_MODES.map((m) => (
            <label key={m.value} className={`segmented__option ${proposal.discount.mode === m.value ? 'segmented__option--active' : ''}`}>
              <input
                type="radio"
                name="discount-mode"
                value={m.value}
                checked={proposal.discount.mode === m.value}
                onChange={() => onDiscountChange('mode', m.value)}
              />
              {m.label}
            </label>
          ))}
        </div>
        {proposal.discount.mode !== 'none' && (
          <FormField
            path="discount.value"
            label={proposal.discount.mode === 'percent' ? 'Porcentaje de descuento' : 'Importe del descuento (€)'}
            value={proposal.discount.value}
            onChange={(v) => onDiscountChange('value', v)}
            onBlur={onBlur}
            error={errorFor('discount.value')}
            inputMode="decimal"
            maxLength={LIMITS.amount}
            placeholder={proposal.discount.mode === 'percent' ? 'Ej.: 10' : 'Ej.: 150'}
            className="discount__value"
          />
        )}
      </fieldset>

      <fieldset
        className={`tax-options ${taxError ? 'field--error' : ''}`}
        id={fieldIdFromPath('tax.mode')}
        tabIndex={-1}
        aria-describedby={taxError ? `${fieldIdFromPath('tax.mode')}-error` : undefined}
      >
        <legend className="field__label">
          Impuestos<span className="field__required" aria-hidden="true"> *</span>
        </legend>
        <div className="tax-options__grid">
          {TAX_MODES.map((mode) => (
            <label key={mode.value} className={`choice ${proposal.tax.mode === mode.value ? 'choice--active' : ''}`}>
              <input
                type="radio"
                name="tax-mode"
                value={mode.value}
                checked={proposal.tax.mode === mode.value}
                onChange={() => onTaxChange('mode', mode.value)}
              />
              <span className="choice__label">{mode.label}</span>
              <span className="choice__hint">{mode.hint}</span>
            </label>
          ))}
        </div>
        {taxError && (
          <p className="field__error" id={`${fieldIdFromPath('tax.mode')}-error`}>
            {taxError}
          </p>
        )}
        {proposal.tax.mode === 'unspecified' && (
          <p className="inline-note">Consejo: aclarar si el precio incluye impuestos evita malentendidos con el cliente.</p>
        )}
      </fieldset>

      {proposal.tax.mode === 'excluded' && (
        <div className="field-row field-row--tax">
          <FormField
            path="tax.rate"
            label="Porcentaje"
            optional
            hint="Si lo indicas, se calculará el total con impuestos."
            value={proposal.tax.rate}
            onChange={(v) => onTaxChange('rate', v)}
            onBlur={onBlur}
            error={errorFor('tax.rate')}
            inputMode="decimal"
            maxLength={6}
            placeholder="Ej.: 21"
          />
          <FormField
            path="tax.label"
            label="Nombre del impuesto"
            hint="Por ejemplo: IVA o IGIC."
            value={proposal.tax.label}
            onChange={(v) => onTaxChange('label', v)}
            onBlur={onBlur}
            error={errorFor('tax.label')}
            maxLength={LIMITS.taxLabel}
          />
        </div>
      )}

      <dl className="totals-summary" aria-live="polite">
        {totals.discount.cents > 0 && (
          <>
            <div>
              <dt>Conceptos</dt>
              <dd>{formatCents(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>Descuento{totals.discount.percent !== null ? ` (${formatPercent(totals.discount.percent)})` : ''}</dt>
              <dd>{formatCents(-totals.discount.cents)}</dd>
            </div>
          </>
        )}
        {totals.taxRate !== null && (
          <>
            <div>
              <dt>Base</dt>
              <dd>{formatCents(totals.base)}</dd>
            </div>
            <div>
              <dt>
                {proposal.tax.label || 'Impuestos'} ({formatPercent(totals.taxRate)})
              </dt>
              <dd>{formatCents(totals.taxAmount)}</dd>
            </div>
          </>
        )}
        <div className="totals-summary__total">
          <dt>Total</dt>
          <dd>{formatCents(totals.total)}</dd>
        </div>
      </dl>
      {!totals.valid && totals.lines.length > 0 && <p className="totals-summary__warn">Revisa los importes marcados.</p>}
    </>
  )
}
