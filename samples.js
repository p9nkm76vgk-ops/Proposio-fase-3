// Ejemplos por profesión: propuestas completas y ficticias para empezar en segundos.
// Todos los nombres, contactos e importes son inventados y se presentan como ejemplo:
// el usuario debe revisarlos y poner los suyos antes de enviar nada.

import {
  createDeliverable as d,
  createEmptyProposal,
  createExtra,
  createPhase as ph,
  createPriceItem as item,
  createSampleProposal,
} from './proposal.js'
import { todayISO } from './format.js'

function base(design, fields) {
  return {
    ...createEmptyProposal({ design }),
    project: { title: fields.title, date: todayISO(), validityDays: '30' },
    ...fields.rest,
  }
}

const photography = (design) =>
  base(design, {
    title: 'Reportaje fotográfico de producto para la tienda online',
    rest: {
      professional: { name: 'Marta Gil · Fotografía', contact: 'marta@martagil.example · 600 000 001' },
      client: { name: 'Cerámicas Alba', contact: 'A la atención de Lucía Alba' },
      objective:
        'Cerámicas Alba va a abrir su tienda online y necesita fotografías de producto homogéneas, con fondo neutro y algunas imágenes de ambiente para redes sociales.',
      service:
        'Sesión de fotografía de producto en estudio, con fondo neutro e iluminación uniforme para que todo el catálogo tenga el mismo estilo.\n\nIncluye una segunda sesión corta de fotografías de ambiente en el taller.',
      deliverables: [
        d('40 fotografías de producto editadas', 'En alta resolución y en formato web, recortadas a 1:1 y 4:5.'),
        d('10 fotografías de ambiente en el taller'),
        d('Galería online privada para descargar las imágenes'),
      ],
      timeline: 'Entrega de las fotografías editadas en 10 días laborables desde la sesión.',
      phases: [ph('Sesión de producto en estudio', 'Día 1'), ph('Sesión de ambiente en el taller', 'Día 2'), ph('Edición y entrega', 'Días 3 a 12')],
      priceItems: [item('Sesión de producto en estudio (horas)', '75', '4'), item('Sesión de ambiente', '180'), item('Edición por fotografía', '6', '50')],
      extras: [createExtra('10 fotografías de producto adicionales', '90'), createExtra('Entrega urgente en 72 horas', '120')],
      tax: { mode: 'excluded', rate: '21', label: 'IVA' },
      paymentTerms: '30 % para reservar la fecha y 70 % a la entrega de la galería, por transferencia.',
      revisions: 'Una ronda de ajustes de edición sobre la selección final.',
      exclusions: 'Atrezo y alquiler de localizaciones.\nRetoque avanzado de producto (eliminar defectos o montajes).',
      nextSteps: 'Aceptar la propuesta.\nElegir fecha para la sesión.\nPreparar los productos que se van a fotografiar.',
    },
  })

const development = (design) =>
  base(design, {
    title: 'Aplicación web para gestionar reservas',
    rest: {
      professional: { name: 'Sergio Pardo · Desarrollo de software', contact: 'sergio@sergiopardo.example · 600 000 002' },
      client: { name: 'Fisioterapia Norte', contact: 'A la atención de Paula Ibáñez' },
      objective:
        'Fisioterapia Norte gestiona las citas por teléfono y en una hoja de cálculo. Quiere que sus pacientes reserven en línea y que el equipo vea la agenda de cada fisioterapeuta.',
      service:
        'Desarrollo de una aplicación web de reservas con calendario por profesional, recordatorios por correo y un panel para el equipo.\n\nSe entrega publicada en el alojamiento del cliente y con el código fuente.',
      deliverables: [
        d('Página de reservas para pacientes, adaptada a móvil'),
        d('Panel para el equipo con la agenda de cada fisioterapeuta'),
        d('Recordatorios automáticos por correo 24 horas antes'),
        d('Documentación y sesión de formación de 1 hora'),
      ],
      timeline: 'Duración estimada: 6 semanas desde la aceptación.',
      phases: [ph('Análisis y prototipo', 'Semana 1'), ph('Desarrollo', 'Semanas 2 a 5'), ph('Pruebas y puesta en marcha', 'Semana 6')],
      priceItems: [item('Análisis y prototipo', '600'), item('Desarrollo (horas)', '45', '80'), item('Pruebas y puesta en marcha', '450')],
      extras: [createExtra('Soporte y mantenimiento durante 3 meses', '360'), createExtra('Recordatorios por SMS', '250')],
      tax: { mode: 'excluded', rate: '21', label: 'IVA' },
      paymentTerms: '40 % a la aceptación, 30 % al entregar el prototipo y 30 % a la puesta en marcha.',
      revisions: 'Dos rondas de cambios sobre el prototipo. Los cambios posteriores se presupuestan aparte.',
      exclusions: 'Alojamiento y dominio.\nCoste de envío de SMS o correos de proveedores externos.',
      nextSteps: 'Aceptar la propuesta.\nAbonar el primer pago.\nAgendar la reunión de análisis.',
    },
  })

const consulting = (design) =>
  base(design, {
    title: 'Plan de mejora de procesos en el almacén',
    rest: {
      professional: { name: 'Andrés Vidal · Consultoría de operaciones', contact: 'andres@andresvidal.example · 600 000 003' },
      client: { name: 'Distribuciones Ribera', contact: 'A la atención de Carmen Ribera' },
      objective:
        'Distribuciones Ribera tiene retrasos en la preparación de pedidos y errores de inventario. Quiere saber dónde se pierde el tiempo y qué cambios concretos hacer.',
      service:
        'Diagnóstico del proceso de preparación de pedidos con visitas al almacén y entrevistas al equipo, seguido de un plan de mejora priorizado y acompañamiento en su puesta en marcha.',
      deliverables: [
        d('Informe de diagnóstico con mediciones de tiempos y errores'),
        d('Plan de mejora priorizado por impacto y coste'),
        d('Dos sesiones de seguimiento con el equipo'),
      ],
      timeline: 'Duración estimada: 5 semanas.',
      phases: [ph('Visitas y entrevistas', 'Semanas 1 y 2'), ph('Informe y plan', 'Semana 3'), ph('Seguimiento', 'Semanas 4 y 5')],
      priceItems: [item('Jornadas de diagnóstico en el almacén', '550', '3'), item('Informe y plan de mejora', '900'), item('Sesiones de seguimiento', '300', '2')],
      extras: [createExtra('Formación al equipo (media jornada)', '400')],
      tax: { mode: 'excluded', rate: '21', label: 'IVA' },
      paymentTerms: '50 % al inicio y 50 % a la entrega del plan de mejora.',
      revisions: 'Una revisión del informe con la dirección antes de cerrarlo.',
      exclusions: 'Compra de equipos o programas.\nDesplazamientos fuera de la provincia.',
      nextSteps: 'Aceptar la propuesta.\nFijar las fechas de las visitas.\nCompartir los datos de pedidos de los últimos 3 meses.',
    },
  })

const marketing = (design) =>
  base(design, {
    title: 'Gestión de redes sociales durante 3 meses',
    rest: {
      professional: { name: 'Nerea Campos · Marketing digital', contact: 'nerea@nereacampos.example · 600 000 004' },
      client: { name: 'Restaurante El Puerto', contact: 'A la atención de Iván Soto' },
      objective:
        'El Puerto quiere llenar más mesas entre semana y dar a conocer su nuevo menú del día entre la gente que trabaja en la zona.',
      service:
        'Gestión de Instagram y Facebook durante tres meses: calendario de publicaciones, creación de contenido, respuesta a mensajes y un informe mensual de resultados.',
      deliverables: [
        d('Calendario mensual de publicaciones'),
        d('12 publicaciones y 8 historias al mes', 'Con fotografías del restaurante aportadas por el cliente.'),
        d('Respuesta a mensajes y comentarios en horario laboral'),
        d('Informe mensual con resultados y propuestas'),
      ],
      timeline: 'Tres meses desde la fecha de inicio acordada.',
      priceItems: [item('Puesta en marcha y estrategia', '250'), item('Gestión mensual', '390', '3')],
      extras: [createExtra('Sesión de fotos de platos (2 horas)', '220'), createExtra('Campaña de anuncios: gestión mensual', '150')],
      tax: { mode: 'excluded', rate: '21', label: 'IVA' },
      paymentTerms: 'Puesta en marcha al aceptar y cuota mensual por adelantado, por transferencia.',
      revisions: 'El cliente aprueba el calendario de cada mes antes de publicar.',
      exclusions: 'Inversión en anuncios (se paga directamente a la plataforma).\nFotografía profesional.',
      nextSteps: 'Aceptar la propuesta.\nDar acceso a las cuentas.\nReunión de inicio para definir el tono.',
    },
  })

export const SAMPLE_PROFESSIONS = [
  { id: 'web', label: 'Diseño y desarrollo web', example: 'Web para una panadería', build: (design) => createSampleProposal({ design }) },
  { id: 'photo', label: 'Fotografía', example: 'Fotos de producto para una tienda', build: photography },
  { id: 'dev', label: 'Desarrollo de software', example: 'App de reservas para una clínica', build: development },
  { id: 'consulting', label: 'Consultoría', example: 'Mejora de procesos en un almacén', build: consulting },
  { id: 'marketing', label: 'Marketing y redes sociales', example: 'Redes de un restaurante', build: marketing },
]

export function createProfessionSample(id, design) {
  const entry = SAMPLE_PROFESSIONS.find((s) => s.id === id) ?? SAMPLE_PROFESSIONS[0]
  return entry.build(design)
}
