# Lista de lanzamiento de proposio

Orden recomendado. No hace falta gastar dinero hasta el paso 5, y solo si hay motivo.

**Aviso:** esto es una guía práctica, no asesoramiento legal ni fiscal. Lo marcado con ⚖️ conviene
confirmarlo con una gestoría o un abogado.

---

## 1. Producto (gratis)

- [ ] Sube todos los archivos a GitHub y comprueba que la página de inicio (`index.html`) y la app
      (`app.html`) cargan.
- [ ] Pruebas en el móvil (Safari en iPhone, Chrome en Android) y en el ordenador (Chrome, Firefox,
      Safari, Edge):
  - [ ] Cargar el ejemplo, cambiar de plantilla y color, subir un logotipo.
  - [ ] Descargar el PDF y revisar acentos, ñ, €, totales e IVA.
  - [ ] Recargar la página: el borrador sigue ahí.
  - [ ] Llegar al límite de 3 propuestas y ver el aviso.
- [ ] Prueba con 3–5 personas reales (`PRUEBAS-USUARIOS.md`) y corrige los 2–3 problemas que más se repitan.

## 2. Cuentas (gratis)

- [ ] Sigue `CONFIGURAR-CUENTAS.md` y pruébalo con tu email.
- [ ] Prueba el envío por enlace de principio a fin: envía, ábrelo en otro dispositivo, acepta con un extra
      y comprueba el aviso y el panel.
- [ ] Conecta un servicio de correo propio antes de invitar a otras personas (el de Supabase solo
      envía a tu equipo y unos 2 emails por hora).

## 3. Legal y fiscal ⚖️

- [ ] **Aviso legal** (`aviso-legal.html`): añade NIF y domicilio en `legal.mjs` (obligatorio por la LSSI-CE) y regenera.
- [ ] **Textos legales** (`legal.mjs`): revísalos con un profesional antes de abrir al público.
- [ ] **Antes de cobrar**: redacta las condiciones de contratación (precio, impuestos, renovación, cancelación y desistimiento) y actualiza la Política de Privacidad con el proveedor de pagos.
- [ ] **Identificación del titular:** la ley española de servicios web suele exigir publicar nombre,
      NIF, domicilio y email de quien presta un servicio con actividad económica. Si no quieres
      publicar tu domicilio personal, consulta alternativas (domicilio profesional, coworking,
      servicio de domiciliación o una sociedad).
- [ ] **Darte de alta** como autónomo (o la forma que te indique tu gestoría) antes de cobrar con
      regularidad.
- [ ] **IVA y facturas:** decide si los precios incluyen IVA, cómo se emiten las facturas y qué
      obligaciones te aplican (incluido el sistema de facturación verificable si te afecta).
- [ ] **Cookies:** proposio solo usa almacenamiento del navegador imprescindible para funcionar,
      sin publicidad ni analítica, por lo que en principio no necesita aviso de cookies. Si algún
      día añades analítica, revísalo.

## 4. Pagos

- [ ] Sigue `CONFIGURAR-PAGOS.md` en modo de prueba.
- [ ] Prueba suscribirte, cambiar de plan, cancelar y eliminar la cuenta.
- [ ] Solo después: paso a cobros reales (paso 11 de esa guía).

## 5. Costes

| Concepto | Coste | Cuándo |
|---|---|---|
| GitHub Pages (web) | 0 € | Siempre |
| Supabase plan gratuito | 0 € | Para empezar. El plan de pago empieza en torno a 25 $/mes; solo si lo necesitas (más uso, copias de seguridad, sin pausas) |
| Correo para usuarios (Brevo, Resend…) | 0 € en sus planes gratuitos | Antes de invitar usuarios |
| Dominio propio | ≈ 10–15 €/año (estimación) | Opcional; mejora la entrega de emails y la imagen |
| Stripe | Sin cuota; por cada cobro | Al cobrar |

**Ejemplo orientativo de un cobro de Pro a 7,90 € con IVA incluido** (tarifas de la web de Stripe
para España; compruébalas):

| Concepto | Importe |
|---|---|
| Precio cobrado | 7,90 € |
| IVA incluido (21 %) | ≈ 1,37 € |
| Comisión de pago (1,5 % + 0,25 €) | ≈ 0,37 € |
| Comisión de suscripciones (0,7 %) | ≈ 0,06 € |
| **Te queda aprox.** | **≈ 6,10 €** antes de tu IRPF y cuota de autónomo |

Son estimaciones: los precios de 7,90 € y 14,90 € son una hipótesis, no un precio validado.

## 6. Seguridad (antes de anunciarlo)

- [ ] En GitHub solo hay claves **públicas** (`proposio-config.js`). Ninguna `sk_...`, `whsec_...`,
      `service_role` ni `secret`.
- [ ] Si alguna clave secreta se publicó por error, regenérala en Stripe o Supabase.
- [ ] En Supabase, **Advisors → Security** no muestra avisos graves.
- [ ] Haz una exportación periódica de la base de datos si sigues en el plan gratuito.

## 7. Anuncio

- [ ] Empieza por tu entorno: compañeros de profesión y comunidades de freelancers.
- [ ] Mide qué pasa: cuántas personas crean una propuesta, cuántas vuelven y cuántas se suscriben.
- [ ] No gastes en publicidad hasta saber que la gente que prueba proposio vuelve a usarlo.
