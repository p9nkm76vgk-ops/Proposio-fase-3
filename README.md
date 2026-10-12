# proposio

Aplicación web en español para crear propuestas comerciales profesionales y descargarlas en PDF.
Pensada para autónomos, freelancers y pequeños negocios.

**Estado: las 5 fases están implementadas.** Sin configurar nada, funciona entera en el navegador.
Las cuentas (Supabase) y los pagos (Stripe) se activan cuando tú quieras, siguiendo las guías.

| Qué | Estado | Guía |
|---|---|---|
| App y PDF (fases 1–2) | Funciona tal cual | — |
| Cuentas y guardado en la nube (fase 3) | Listo, pendiente de conectar tu proyecto de Supabase | `CONFIGURAR-CUENTAS.md` |
| Suscripciones Pro/Business (fase 4) | Listo, pendiente de conectar Stripe | `CONFIGURAR-PAGOS.md` |
| Página comercial, textos legales y lanzamiento (fase 5) | Página lista; textos legales con datos por completar | `LANZAMIENTO.md` |
| Enviar por enlace, extras, catálogo, ejemplos, precio por hora y panel (versión 0.4) | Listo; el envío por enlace necesita las cuentas | Ver «Novedades 0.4» |

## Novedades 0.4: vender más y cerrar antes

Pensadas para que proposio aporte lo que un chat no puede: seguimiento, cierre y tus propios datos.

| Función | Plan (si activas pagos) | Necesita cuentas |
|---|---|---|
| **Enviar al cliente por enlace** (WhatsApp, email o copiar). El cliente la ve en el móvil, descarga el PDF y la **acepta con un botón** escribiendo su nombre. Te avisamos al entrar en la app. | Gratis | Sí |
| **Saber si la abrió** (veces y última vez) | Pro | Sí |
| **Extras opcionales**: servicios que el cliente puede añadir al aceptar. El total lo recalcula el servidor. | Pro | No (en el enlace, sí) |
| **Catálogo de servicios** con precio, para añadirlos con un clic | Pro | No |
| **Panel de negocio**: enviadas, abiertas, aceptadas, importe del mes, tasa de aceptación y recordatorio por WhatsApp de las pendientes (4 días o más) | Pro | Sí |
| **Ejemplos por profesión** (web, fotografía, software, consultoría, marketing) | Gratis | No |
| **Calculadora de precio mínimo por hora** y aviso si una propuesta queda por debajo | Gratis | No |

Para actualizar una web ya publicada: sube los archivos nuevos y modificados (incluidos `app.html` y el nuevo
`ver.html`) y **vuelve a ejecutar `supabase.sql` completo** en el SQL Editor de Supabase (es seguro repetirlo:
añade la tabla de enlaces y las columnas nuevas sin borrar nada).

Qué hay que saber:
- La aceptación registra el nombre que escribe el cliente, la fecha y los extras. No verifica su identidad ni es una
  firma electrónica avanzada; tampoco cobra nada.
- Cualquiera con el enlace puede ver la propuesta. Se puede desactivar en cualquier momento.
- Si cambias una propuesta ya enviada, el cliente sigue viendo la versión anterior hasta que pulses
  «Actualizar enlace con los cambios». Una propuesta aceptada ya no se puede cambiar (duplícala).
- Enviar una propuesta cuenta en el límite mensual igual que descargarla (una vez por propuesta y mes).
- Los avisos de aceptación aparecen al abrir o volver a la app. El aviso por email está preparado y se activa siguiendo `CONFIGURAR-CUENTAS.md` (secciones 11 y 12).
- Cliente y profesional pueden descargar un **justificante de aceptación en PDF** (quién, cuándo, extras, total y huella de la versión).
- **Páginas por profesión** para atraer visitas desde buscadores, enlazadas desde la página de inicio.

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
- Catálogo de servicios con precio y ejemplos completos por profesión (0.4).

**Cuentas (fase 3, opcional)**
- Entrar con un enlace enviado por email (sin contraseña).
- Las propuestas se guardan solas en la cuenta; historial en «Mis propuestas» (abrir y eliminar).
- Tus datos, diseño y textos guardados se sincronizan entre dispositivos.
- Límite mensual aplicado en el servidor (mes calculado con la hora de España); borrar una propuesta no devuelve el cupo.
- Reglas de seguridad por filas: ningún usuario puede leer ni modificar datos de otro.
- Cerrar sesión borra la copia del navegador; «Eliminar mi cuenta» borra todos los datos.

**Suscripciones (fase 4, opcional)**
- Planes Gratis, Pro y Business (este último se puede ocultar hasta tener sus funciones propias).
- Pago con Stripe Checkout y gestión (cambiar de plan, facturas, cancelar) en el portal de Stripe.
- El plan solo lo activa el servidor tras un aviso de Stripe con firma verificada; el navegador no puede dárselo.
- Límite mensual por plan aplicado en el servidor (3 / 30 / 300).
- Sin pagos activados, todas las funciones están disponibles para todos.

**Página comercial y lanzamiento (fase 5)**
- `index.html`: página de inicio que explica el producto, sin testimonios ni cifras inventadas.
- `app.html`: la aplicación.
- `ver.html`: la página que ve tu cliente al abrir el enlace de una propuesta.
- `aviso-legal.html`, `privacidad.html`, `condiciones.html` y `cookies.html` (generados con `legal.mjs`), y una lista de lanzamiento con costes.

**General**
- PDF A4 con jsPDF: saltos de página, cabeceras de tabla repetidas, pie con «Página X de Y» y caracteres españoles.
- Borrador guardado automáticamente; los borradores de la versión anterior se convierten solos.
- Límite de 3 propuestas distintas al mes (**control provisional local**, ver abajo).
- Diseño responsive y accesibilidad básica.

## Qué falta por tu parte

Conectar Supabase y Stripe con tus cuentas, completar los datos legales con asesoramiento y probar con
usuarios reales. Función prevista para Business que aún no existe: varias configuraciones de marca.

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

`index.html` es la página de inicio y `app.html` la aplicación, ya construida con todo el código dentro,
así que GitHub puede servirlas tal cual.

1. Sube todos los archivos al repositorio.
2. En GitHub: **Settings → Pages**.
3. En «Build and deployment», elige **Source: Deploy from a branch**, rama **main** y carpeta **/ (root)**. Pulsa **Save**.
4. Espera uno o dos minutos y abre `https://TU_USUARIO.github.io/proposio/` (inicio) o `.../app.html` (app).

Al pulsar «Descargar PDF», la página descarga la librería jsPDF (versión fija 2.5.1) desde cdnjs.
Solo se descarga la librería: los datos de la propuesta no salen del navegador.

## Trabajar en local (opcional)

Desde la carpeta del proyecto:

```bash
npm install      # solo la primera vez
npm run dev      # abre la versión de desarrollo (dev.html) y recarga al guardar
npm test         # pruebas automáticas de la lógica
npm run build    # regenera app.html y ver.html después de cambiar el código
```

Después de `npm run build`, sube `app.html` y `ver.html` nuevos a GitHub para actualizar la web.
Para probar la vista del cliente en local: `npm run dev` y abre `ver-dev.html?p=CÓDIGO_DEL_ENLACE`.

## Estructura

Todos los archivos están en la misma carpeta, sin subcarpetas.

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página comercial de inicio |
| `app.html` | La aplicación publicable, generada con `npm run build` (no editar a mano) |
| `aviso-legal.html`, `condiciones.html`, `cookies.html` | Aviso legal, Condiciones de Uso y Política de cookies (generados; el aviso legal tiene **NIF y domicilio pendientes**) |
| `legal.mjs` | Textos legales y datos del titular: edítalo aquí y ejecuta `npm run build` |
| `ver.html` | Vista del cliente de una propuesta enviada por enlace, generada con `npm run build` |
| `dev.html` | Página de desarrollo que usa Vite |
| `ver-dev.html`, `ver.jsx` | Página de desarrollo y código de la vista del cliente |
| `build.mjs` | Genera `app.html` y `ver.html`, cada uno en un solo archivo |
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
| `privacidad.html` | Política de Privacidad (generada con `legal.mjs`) |
| `CONFIGURAR-CUENTAS.md` | Guía paso a paso para activar las cuentas |
| `entitlements.js` | Qué incluye cada plan |
| `PlansDialog.jsx` | Ventana de planes y suscripción |
| `edge-create-checkout.ts` | Función de servidor: página de pago de Stripe |
| `edge-customer-portal.ts` | Función de servidor: portal de cliente de Stripe |
| `edge-stripe-webhook.ts` | Función de servidor: avisos de Stripe con firma verificada |
| `CONFIGURAR-PAGOS.md` | Guía paso a paso para activar los pagos |
| `LANZAMIENTO.md` | Lista de lanzamiento: producto, legal, pagos, costes y seguridad |
| `PRUEBAS-USUARIOS.md` | Guía para probar la app con usuarios reales |
| `sharing.js` | Mensajes para enviar, detección de cambios, avisos de aceptación y cifras del panel |
| `ShareDialog.jsx` | Ventana «Enviar al cliente» |
| `DashboardDialog.jsx` | Panel de negocio |
| `ExtrasEditor.jsx` | Extras opcionales |
| `catalog.js`, `CatalogDialog.jsx` | Catálogo de servicios |
| `rate.js`, `RateDialog.jsx` | Calculadora de precio mínimo por hora |
| `samples.js` | Ejemplos por profesión |
| `acceptance.js` | Justificante de aceptación en PDF |
| `pages.mjs` | Genera las páginas «Plantilla de presupuesto para…» y `sitemap.xml` |
| `presupuesto-*.html`, `sitemap.xml` | Páginas por profesión (generadas, no editar a mano) |
| `edge-notify-acceptance.ts` | Función de servidor: email al profesional cuando su cliente acepta |

## Principios

- No se inventa información comercial: el PDF solo contiene lo que escribe el usuario
  (más frases neutras de enlace, como la presentación sugerida, que es editable).
- Sin dependencias ni servicios externos innecesarios.
