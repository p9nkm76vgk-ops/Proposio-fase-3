// Diseño del documento: plantilla, color de acento y logotipo.

import { useRef, useState } from 'react'
import { LOGO_ACCEPT, LogoError, processLogoFile } from './logo.js'
import { ACCENT_PRESETS, TEMPLATES, accentCssVars } from './templates.js'
import { fieldIdFromPath } from './validation.js'
import { Spinner, TrashIcon, UploadIcon } from './Icons.jsx'

/** Miniatura esquemática de cada plantilla. */
function TemplateThumb({ template, accent }) {
  return (
    <span className={`tpl-thumb tpl-thumb--${template}`} style={accentCssVars(accent)} aria-hidden="true">
      <span className="tpl-thumb__head" />
      <span className="tpl-thumb__title" />
      <span className="tpl-thumb__line" />
      <span className="tpl-thumb__line tpl-thumb__line--short" />
      <span className="tpl-thumb__table" />
    </span>
  )
}

export function DesignEditor({ design, onChange }) {
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [logoError, setLogoError] = useState(null)
  const isPreset = ACCENT_PRESETS.some((c) => c.value.toUpperCase() === design.accent.toUpperCase())

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    setLoading(true)
    setLogoError(null)
    try {
      onChange('logo', await processLogoFile(file))
    } catch (error) {
      setLogoError(error instanceof LogoError ? error.message : 'No se pudo procesar la imagen. Prueba con otro archivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <fieldset className="design-group" id={fieldIdFromPath('design.template')} tabIndex={-1}>
        <legend className="field__label">Plantilla</legend>
        <div className="tpl-options">
          {TEMPLATES.map((t) => (
            <label key={t.value} className={`tpl-option ${design.template === t.value ? 'tpl-option--active' : ''}`}>
              <input
                type="radio"
                name="design-template"
                value={t.value}
                checked={design.template === t.value}
                onChange={() => onChange('template', t.value)}
              />
              <TemplateThumb template={t.value} accent={design.accent} />
              <span className="tpl-option__label">{t.label}</span>
              <span className="tpl-option__hint">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="design-group" id={fieldIdFromPath('design.accent')} tabIndex={-1}>
        <legend className="field__label">Color principal</legend>
        <div className="swatches">
          {ACCENT_PRESETS.map((c) => (
            <label key={c.value} className="swatch" title={c.label}>
              <input
                type="radio"
                name="design-accent"
                value={c.value}
                checked={design.accent.toUpperCase() === c.value.toUpperCase()}
                onChange={() => onChange('accent', c.value)}
              />
              <span className="swatch__color" style={{ background: c.value }} />
              <span className="visually-hidden">{c.label}</span>
            </label>
          ))}
          <label className={`swatch swatch--custom ${!isPreset ? 'swatch--active' : ''}`} title="Color personalizado">
            <input
              type="color"
              value={design.accent.toLowerCase()}
              onChange={(e) => onChange('accent', e.target.value.toUpperCase())}
              aria-label="Elegir un color personalizado"
            />
            <span className="swatch__custom-label">Otro</span>
          </label>
        </div>
        <p className="field__hint">
          Si eliges un color muy claro, los textos se oscurecen automáticamente para que se lean bien.
        </p>
      </fieldset>

      <div className="design-group">
        <span className="field__label" id="logo-label">
          Logotipo <span className="field__optional">(opcional)</span>
        </span>
        <div className="logo-picker">
          {design.logo ? (
            <span className="logo-picker__preview">
              <img src={design.logo.dataUrl} alt={`Logotipo actual${design.logo.name ? `: ${design.logo.name}` : ''}`} />
            </span>
          ) : (
            <span className="logo-picker__empty" aria-hidden="true">
              Sin logotipo
            </span>
          )}
          <div className="logo-picker__actions">
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="visually-hidden"
              id="f-design-logo"
              onChange={handleFile}
              aria-labelledby="logo-label"
              aria-describedby="logo-hint"
            />
            <button type="button" className="button button--ghost button--small" onClick={() => fileRef.current?.click()} disabled={loading}>
              {loading ? <Spinner size={16} /> : <UploadIcon size={16} />}
              {design.logo ? 'Cambiar' : 'Subir logotipo'}
            </button>
            {design.logo && (
              <button type="button" className="button button--ghost button--small" onClick={() => onChange('logo', null)}>
                <TrashIcon size={16} /> Quitar
              </button>
            )}
          </div>
        </div>
        <p className="field__hint" id="logo-hint">
          PNG, JPG, WebP o SVG de hasta 5 MB. Se guarda solo en este navegador.
        </p>
        {logoError && <p className="field__error">{logoError}</p>}
      </div>
    </>
  )
}
