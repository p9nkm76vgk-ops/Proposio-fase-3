// Campo de formulario reutilizable: etiqueta + control + ayuda + error.
// Conecta todo con atributos de accesibilidad (aria-describedby, aria-invalid).

import { fieldIdFromPath } from './validation.js'

export function FormField({
  path,
  label,
  required = false,
  optional = false,
  hint,
  error,
  as = 'input',
  value,
  onChange,
  onBlur,
  className = '',
  footer = null,
  ...controlProps
}) {
  const id = fieldIdFromPath(path)
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const Control = as

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__required" aria-hidden="true"> *</span>}
        {optional && <span className="field__optional"> (opcional)</span>}
      </label>
      <Control
        id={id}
        className="field__control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur ? () => onBlur(path) : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required ? 'true' : undefined}
        {...controlProps}
      />
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
      {footer}
    </div>
  )
}

/** Tarjeta que agrupa campos relacionados. */
export function FormSection({ id, step, title, description, children }) {
  return (
    <section className="form-section" aria-labelledby={`${id}-title`}>
      <header className="form-section__header">
        <span className="form-section__step" aria-hidden="true">
          {step}
        </span>
        <div>
          <h2 className="form-section__title" id={`${id}-title`}>
            {title}
          </h2>
          {description && <p className="form-section__description">{description}</p>}
        </div>
      </header>
      <div className="form-section__body">{children}</div>
    </section>
  )
}
