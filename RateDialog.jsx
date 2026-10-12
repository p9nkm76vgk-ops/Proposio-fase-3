// Calculadora «¿Cuánto debo cobrar por hora como mínimo?».
// Usa solo los datos que escribe el usuario (ver rate.js). Gratis para todos.

import { useEffect, useState } from 'react'
import { Modal } from './Feedback.jsx'
import { FormField } from './FormField.jsx'
import { formatCents } from './format.js'
import { computeMinimumRate, loadRateSettings, saveRateSettings } from './rate.js'

const FIELDS = [
  {
    key: 'netMonthly',
    label: 'Lo que quieres ganar al mes, limpio (€)',
    hint: 'Lo que te quieres llevar a casa después de gastos e impuestos.',
    placeholder: 'Ej.: 1.800',
  },
  {
    key: 'expensesMonthly',
    label: 'Gastos del negocio al mes (€)',
    hint: 'Cuota de autónomos, programas, equipo, gestoría, desplazamientos…',
    placeholder: 'Ej.: 450',
    optional: true,
  },
  {
    key: 'taxReservePercent',
    label: '% del beneficio que apartas para impuestos',
    hint: 'Pon el porcentaje que uses tú. Si no lo sabes, pregúntalo a tu asesoría.',
    placeholder: 'Tu porcentaje',
    optional: true,
  },
  {
    key: 'billableHoursWeek',
    label: 'Horas que facturas a la semana',
    hint: 'Solo las que cobras: sin contar correos, presupuestos ni administración.',
    placeholder: 'Ej.: 25',
  },
  {
    key: 'weeksOff',
    label: 'Semanas al año sin facturar',
    hint: 'Vacaciones, festivos, bajas o meses flojos.',
    placeholder: 'Ej.: 6',
    optional: true,
  },
]

export function RateDialog({ open, onClose, onSaved }) {
  const [settings, setSettings] = useState(loadRateSettings)
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (open) {
      setSettings(loadRateSettings())
      setTouched({})
    }
  }, [open])

  const result = computeMinimumRate(settings)

  const save = () => {
    saveRateSettings(settings)
    onSaved?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Tu precio mínimo por hora"
      onClose={onClose}
      wide
      actions={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="button button--primary" onClick={save}>
            Guardar y usar
          </button>
        </>
      }
    >
      <p className="modal__muted">
        Calcula cuánto necesitas cobrar por hora para llegar a lo que quieres ganar. Se guarda para tus próximas propuestas.
      </p>
      <div className="rate-form">
        {FIELDS.map((f) => (
          <FormField
            key={f.key}
            path={`rate.${f.key}`}
            label={f.label}
            hint={f.hint}
            optional={f.optional}
            value={settings[f.key]}
            onChange={(v) => setSettings((prev) => ({ ...prev, [f.key]: v }))}
            onBlur={() => setTouched((prev) => ({ ...prev, [f.key]: true }))}
            error={touched[f.key] ? result.errors[f.key] : undefined}
            inputMode="decimal"
            maxLength={12}
            placeholder={f.placeholder}
          />
        ))}
      </div>

      <div className={`rate-result ${result.complete ? '' : 'rate-result--empty'}`} aria-live="polite">
        {result.complete ? (
          <>
            <p className="rate-result__value">
              <span>Precio mínimo</span>
              <strong>{formatCents(result.hourlyCents)} / hora</strong>
            </p>
            <p className="rate-result__detail">
              Necesitas facturar unos {formatCents(result.revenueCents)} al año (sin IVA) en{' '}
              {Math.round(result.billableHours).toLocaleString('es-ES')} horas facturables.
            </p>
          </>
        ) : (
          <p>Escribe lo que quieres ganar y tus horas facturables para ver el resultado.</p>
        )}
      </div>
      <p className="share__fine">
        Es una estimación con tus propios datos, no un asesoramiento fiscal. Cobrar por debajo de este precio significa no
        llegar a tu objetivo.
      </p>
    </Modal>
  )
}
