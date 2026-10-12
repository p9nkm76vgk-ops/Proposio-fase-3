// Formulario completo de la propuesta, dividido en siete bloques.

import { suggestedIntroduction } from './document.js'
import { LIMITS } from './validation.js'
import { DeliverablesEditor } from './DeliverablesEditor.jsx'
import { DesignEditor } from './DesignEditor.jsx'
import { FormField, FormSection } from './FormField.jsx'
import { PricingEditor } from './PricingEditor.jsx'
import { SnippetBar } from './SnippetBar.jsx'
import { TimelineEditor } from './TimelineEditor.jsx'

export function ProposalForm({ proposal, onFieldChange, onBlur, errorFor }) {
  // Ayudante para no repetir value/onChange/onBlur/error en cada campo.
  const bind = (path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], proposal) ?? ''
    return {
      path,
      value,
      onChange: (v) => onFieldChange(path, v),
      onBlur,
      error: errorFor(path),
    }
  }

  // Campo de texto largo con "textos guardados" debajo.
  const withSnippets = (path) => ({
    ...bind(path),
    footer: <SnippetBar field={path} value={proposal[path]} onInsert={(text) => onFieldChange(path, text)} />,
  })

  const suggestion = suggestedIntroduction(proposal)

  return (
    <form className="proposal-form" noValidate onSubmit={(e) => e.preventDefault()}>
      <FormSection
        id="sec-design"
        step="1"
        title="Diseño y marca"
        description="Se recuerda para tus próximas propuestas."
      >
        <DesignEditor design={proposal.design} onChange={(key, value) => onFieldChange(`design.${key}`, value)} />
      </FormSection>

      <FormSection id="sec-general" step="2" title="Datos generales" description="Quién propone, a quién y sobre qué.">
        <div className="field-row">
          <FormField
            {...bind('professional.name')}
            label="Tu nombre o empresa"
            required
            maxLength={LIMITS.shortText}
            autoComplete="organization"
            placeholder="Ej.: Laura Martín · Diseño web"
          />
          <FormField
            {...bind('professional.contact')}
            label="Tus datos de contacto"
            optional
            maxLength={LIMITS.contact}
            placeholder="Email, teléfono o web"
          />
        </div>
        <div className="field-row">
          <FormField {...bind('client.name')} label="Cliente" required maxLength={LIMITS.shortText} placeholder="Ej.: Panadería La Espiga" />
          <FormField
            {...bind('client.contact')}
            label="Persona de contacto del cliente"
            optional
            maxLength={LIMITS.contact}
            placeholder="Ej.: A la atención de Jorge Ruiz"
          />
        </div>
        <FormField {...bind('project.title')} label="Título del proyecto" required maxLength={LIMITS.title} placeholder="Ej.: Nueva web corporativa" />
        <div className="field-row">
          <FormField {...bind('project.date')} label="Fecha de emisión" required type="date" />
          <FormField
            {...bind('project.validityDays')}
            label="Validez de la oferta (días)"
            optional
            hint="Si lo dejas vacío, no se indicará validez."
            inputMode="numeric"
            maxLength={3}
            placeholder="Ej.: 30"
          />
        </div>
      </FormSection>

      <FormSection id="sec-project" step="3" title="El proyecto" description="Qué necesita el cliente y cómo lo resuelves.">
        <FormField
          {...bind('objective')}
          as="textarea"
          rows={4}
          label="Necesidad u objetivo del cliente"
          required
          maxLength={LIMITS.longText}
          placeholder="¿Qué problema quiere resolver o qué quiere conseguir?"
        />
        <FormField
          {...withSnippets('service')}
          as="textarea"
          rows={5}
          label="Servicio que ofreces"
          required
          maxLength={LIMITS.longText}
          placeholder="Describe tu enfoque y en qué consiste el trabajo."
        />
        <FormField
          {...bind('introduction')}
          as="textarea"
          rows={3}
          label="Texto de presentación"
          optional
          hint="Si lo dejas vacío, se usará el texto sugerido que aparece en gris dentro de la casilla."
          maxLength={LIMITS.longText}
          placeholder={suggestion || 'Completa tu nombre, el cliente y el título para ver un texto sugerido.'}
        />
        {suggestion && proposal.introduction.trim() === '' && (
          <button type="button" className="button button--ghost button--small" onClick={() => onFieldChange('introduction', suggestion)}>
            Editar a partir del texto sugerido
          </button>
        )}
      </FormSection>

      <FormSection
        id="sec-deliverables"
        step="4"
        title="Entregables y plazos"
        description="Lo que recibirá el cliente y cuándo. Pulsa Intro para añadir otro entregable."
      >
        <div className="field">
          <span className="field__label">
            Entregables<span className="field__required" aria-hidden="true"> *</span>
          </span>
          <DeliverablesEditor
            items={proposal.deliverables}
            onChange={(items) => onFieldChange('deliverables', items)}
            error={errorFor('deliverables')}
            errorFor={errorFor}
          />
        </div>
        <FormField
          {...withSnippets('timeline')}
          as="textarea"
          rows={3}
          label="Plazos"
          required
          hint="Escribe un texto, añade fases o ambas cosas."
          maxLength={LIMITS.longText}
          placeholder="Ej.: 4 semanas desde la aceptación de la propuesta."
        />
        <TimelineEditor
          phases={proposal.phases}
          onChange={(phases) => onFieldChange('phases', phases)}
          errorFor={errorFor}
          onBlur={onBlur}
        />
      </FormSection>

      <FormSection
        id="sec-pricing"
        step="5"
        title="Precio"
        description="Desglosa el precio por conceptos. Solo se muestran los importes que escribas."
      >
        <PricingEditor
          proposal={proposal}
          onItemsChange={(items) => onFieldChange('priceItems', items)}
          onDiscountChange={(key, value) => onFieldChange(`discount.${key}`, value)}
          onTaxChange={(key, value) => onFieldChange(`tax.${key}`, value)}
          errorFor={errorFor}
          onBlur={onBlur}
        />
      </FormSection>

      <FormSection id="sec-terms" step="6" title="Condiciones" description="Cómo se paga, qué incluye y qué no. Guarda tus textos habituales para reutilizarlos.">
        <FormField
          {...withSnippets('paymentTerms')}
          as="textarea"
          rows={3}
          label="Condiciones de pago"
          required
          maxLength={LIMITS.longText}
          placeholder="Ej.: 50 % al aceptar y 50 % a la entrega, por transferencia."
        />
        <FormField
          {...withSnippets('revisions')}
          as="textarea"
          rows={2}
          label="Revisiones incluidas"
          required
          maxLength={LIMITS.longText}
          placeholder="Ej.: Dos rondas de cambios sobre el diseño."
        />
        <FormField
          {...withSnippets('exclusions')}
          as="textarea"
          rows={3}
          label="No incluido en el presupuesto"
          optional
          hint="Una exclusión por línea."
          maxLength={LIMITS.longText}
          placeholder={'Ej.: Redacción de textos\nFotografía de producto'}
        />
      </FormSection>

      <FormSection id="sec-next" step="7" title="Próximos pasos" description="Qué debe hacer el cliente para aceptar.">
        <FormField
          {...withSnippets('nextSteps')}
          as="textarea"
          rows={3}
          label="Pasos para aceptar la propuesta"
          required
          hint="Un paso por línea. Se mostrarán numerados."
          maxLength={LIMITS.longText}
          placeholder={'Ej.: Confirmar por correo la aceptación\nAbonar el primer pago'}
        />
      </FormSection>
    </form>
  )
}
