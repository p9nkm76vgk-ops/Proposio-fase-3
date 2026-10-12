# proposio

Aplicación web en español para crear propuestas comerciales profesionales y descargarlas en PDF.
Pensada para autónomos, freelancers y pequeños negocios.

**Estado: Fase 3 completada.** Sin configurar nada, funciona entera en el navegador (los datos no
salen del dispositivo). Si activas las cuentas con Supabase (ver `CONFIGURAR-CUENTAS.md`), cada
usuario puede guardar sus propuestas en la nube y el límite mensual lo aplica el servidor.

## Qué hace (implementado)

**Propuesta**
- Formulario en 7 bloques: diseño y marca, datos generales, proyecto, entregables y plazos, precio, condiciones y próximos pasos.
- Validación con mensajes claros; al intentar descargar, lleva al primer campo con error.
- Vista previa en vivo que coincide con el PDF (ambos usan `document.js`).
- Entregables con detalle opcional; plazos en texto y/o tabla de fases.
- Precio por conceptos con cantidad × precio unitario, descuento opcional (porcentaje o importe)
  y tratamiento explícito de impuestos (incluidos / no incluidos / no especificado).

**Diseño del documento (fase 2)**
- 3 plantillas: Clásica, Moderna y Minimalista.
- Color principal (6 sugeridos o uno propio). Si es muy claro, los textos se oscurecen solos para leerse bien.
- Logotipo propio (PNG, JPG, WebP o SVG), procesado en el navegador.

**Reutilización (fase 2)**
- Tus datos y tu diseño se recuerdan para cada propuesta nueva.
- Textos guardados para servicio, plazos, condiciones de pago, revisiones, exclusiones y próximos pasos.
- Duplicar una propuesta para crear otra parecida.

**Cuentas (fase 3, opcional)**
- Entrar con un enlace enviado por email (sin contraseña).
- Las propuestas se guardan solas en la cuenta; historial en «Mis propuestas» (abrir y eliminar).
- Tus datos, diseño y textos guardados se sincronizan entre dispositivos.
- Límite mensual aplicado en el servidor (mes calculado con la hora de España); borrar una propuesta no devuelve el cupo.
- Reglas de seguridad por filas: ningún usuario puede leer ni modificar datos de otro.
- Cerrar sesión borra la copia del navegador; «Eliminar mi cuenta» borra todos los datos.

**General**
- PDF A4 con jsPDF: saltos de página, cabeceras de tabla repetidas, pie con «Página X de Y» y caracteres españoles.
- Borrador guardado automáticamente; los borradores de la versión anterior se convierten solos.
- Límite de 3 propuestas distintas al mes (**control provisional local**, ver abajo).
- Diseño responsive y accesibilidad básica.

## Qué NO hace todavía (previsto)

Planes de pago (fase 4) y página comercial, textos legales definitivos y lanzamiento (fase 5).

Limitación conocida: el PDF se genera en el navegador. Con cuenta, el servidor controla el
contador de forma fiable, pero una persona con conocimientos técnicos podría generar el PDF
sin pasar por él. Si hiciera falta un control total, en la fase 4 se valorará generar el PDF en el servidor.
De momento todas las funciones están disponibles para todos; qué entra en cada plan se decidirá cuando existan cuentas y pagos.

### Sobre el límite mensual

El contador se guarda en el navegador. Es solo para probar la experiencia: cualquiera puede reiniciarlo
borrando los datos del sitio. El límite real se aplicará en el servidor cuando existan cuentas (fase 3/4).
Una propuesta cuenta la primera vez que se descarga en el mes; volver a descargarla no cuenta otra vez.

## Requisitos (solo para trabajar en local)

- **Node.js 20.19 o superior** (recomendado: la versión LTS de https://nodejs.org).
  Comprueba tu versión con `node -v`.

## Verla publicada en GitHub Pages (gratis, sin instalar nada)

`index.html` ya está construido: lleva dentro todo el código, así que GitHub puede servirlo tal cual.

1. Sube todos los archivos al repositorio.
2. En GitHub: **Settings → Pages**.
3. En «Build and deployment», elige **Source: Deploy from a branch**, rama **main** y carpeta **/ (root)**. Pulsa **Save**.
4. Espera uno o dos minutos y abre `https://TU_USUARIO.github.io/proposio/`.

Al pulsar «Descargar PDF», la página descarga la librería jsPDF (versión fija 2.5.1) desde cdnjs.
Solo se descarga la librería: los datos de la propuesta no salen del navegador.

## Trabajar en local (opcional)

Desde la carpeta del proyecto:

```bash
npm install      # solo la primera vez
npm run dev      # abre la versión de desarrollo (dev.html) y recarga al guardar
npm test         # pruebas automáticas de la lógica
npm run build    # regenera index.html después de cambiar el código
```

Después de `npm run build`, sube el `index.html` nuevo a GitHub para actualizar la web.

## Estructura

Todos los archivos están en la misma carpeta, sin subcarpetas.

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Versión publicable, generada con `npm run build` (no editar a mano) |
| `dev.html` | Página de desarrollo que usa Vite |
| `build.mjs` | Genera `index.html` en un solo archivo |
| `package.json`, `vite.config.js` | Dependencias y configuración |
| `main.jsx` | Punto de entrada de React |
| `App.jsx` | Estado principal y coordinación |
| `styles.css` | Estilos (variables, componentes, responsive) |
| `AppHeader.jsx` | Cabecera, contador y acciones |
| `ProposalForm.jsx` | Formulario completo |
| `FormField.jsx` | Campo y bloque de formulario reutilizables |
| `DeliverablesEditor.jsx` | Lista de entregables |
| `PricingEditor.jsx` | Conceptos, impuestos y totales |
| `ProposalPreview.jsx` | Vista previa del documento |
| `DesignEditor.jsx` | Plantilla, color y logotipo |
| `TimelineEditor.jsx` | Fases del proyecto |
| `SnippetBar.jsx` | Textos guardados bajo cada campo |
| `BrandMark.jsx` | Logotipo de proposio |
| `Feedback.jsx` | Avisos (toast) y ventana modal |
| `Icons.jsx` | Iconos SVG |
| `proposal.js` | Modelo de datos y datos de ejemplo |
| `validation.js` | Reglas de validación |
| `pricing.js` | Cálculos en céntimos |
| `document.js` | Datos → documento estructurado (lo usan vista previa y PDF) |
| `pdf.js` | Maquetación del PDF con jsPDF (3 plantillas) |
| `jspdfLoader.js` | Carga jsPDF solo al descargar |
| `pdfText.js` | Limpieza de caracteres para el PDF |
| `format.js` | Importes, fechas y textos |
| `usage.js` | Límite mensual provisional |
| `drafts.js` | Borrador local |
| `storage.js` | Acceso seguro a localStorage |
| `templates.js` | Plantillas y cálculo de colores legibles |
| `logo.js` | Procesado del logotipo del usuario |
| `profile.js` | Tus datos y diseño para próximas propuestas |
| `snippets.js` | Textos guardados |
| `logic.test.js` | Pruebas automáticas (`npm test`) |
| `proposio-config.js` | **Configuración editable sin recompilar** (claves públicas de Supabase) |
| `config.js` | Lee y valida la configuración |
| `cloud.js` | Todas las llamadas a Supabase (sesión, propuestas, perfil, uso) |
| `supabaseLoader.js` | Carga la librería de Supabase solo si hay cuentas |
| `AccountDialogs.jsx` | Ventanas de entrar, mis propuestas y mi cuenta |
| `supabase.sql` | Tablas, reglas de seguridad y límite mensual (se pega en Supabase) |
| `privacidad.html` | Política de privacidad (**borrador con datos a completar**) |
| `CONFIGURAR-CUENTAS.md` | Guía paso a paso para activar las cuentas |
| `PRUEBAS-USUARIOS.md` | Guía para probar la app con usuarios reales |

## Principios

- No se inventa información comercial: el PDF solo contiene lo que escribe el usuario
  (más frases neutras de enlace, como la presentación sugerida, que es editable).
- Sin dependencias ni servicios externos innecesarios.
