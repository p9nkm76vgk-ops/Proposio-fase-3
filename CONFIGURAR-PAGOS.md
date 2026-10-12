# Activar los pagos (Stripe)

Mientras `payments.enabled` sea `false` en `proposio-config.js`, proposio no muestra planes de pago
y todas las funciones están disponibles para todos.

**Antes de empezar:** las cuentas tienen que estar activadas y probadas (`CONFIGURAR-CUENTAS.md`).
Los pagos van asociados a cada cuenta.

**Coste:** Stripe no tiene cuota mensual. Cobra por cada pago (en España, según su web: 1,5 % + 0,25 €
por tarjeta europea, más un 0,7 % por gestionar suscripciones). Comprueba las tarifas actuales en
<https://stripe.com/es/pricing>. Ejemplo orientativo en `LANZAMIENTO.md`.

Todo se hace primero en **modo de prueba**: no se cobra dinero real y no hace falta verificar tu
identidad. Cuando todo funcione, se repite en modo real (paso 11).

---

## 1. Crea la cuenta de Stripe

Regístrate en <https://stripe.com/es>. Asegúrate de que arriba está activado **Modo de prueba**
(o «Entorno de prueba»).

## 2. Crea los productos y precios

En **Catálogo de productos → Añadir producto**:

- Nombre: `proposio Pro` · Precio: `7,90` EUR · **Recurrente** · **Mensual**.
- Guarda y copia el **ID del precio** (empieza por `price_`).
- Opcional: repite con `proposio Business` (14,90 € al mes).

Sobre el IVA: decide con tu gestoría si el precio incluye impuestos. El precio que se muestra a
consumidores debe ser el precio final.

## 3. Configura el portal de cliente

En **Configuración → Facturación → Portal de clientes** activa:

- Cancelar suscripciones (**al final del periodo de facturación**).
- Cambiar de plan (añade los productos Pro y, si lo usas, Business).
- Actualizar la forma de pago y ver el historial de facturas.

Guarda los cambios. Es la página que abre «Gestionar suscripción» en la app.

## 4. Copia la clave secreta de Stripe

En **Desarrolladores → Claves de API**, copia la **clave secreta** (`sk_test_...`).

⚠️ Esta clave es **secreta**: solo va en Supabase (paso 6). Nunca en `proposio-config.js`, en GitHub
ni en ningún archivo de la web.

## 5. Crea las funciones de servidor en Supabase

En tu proyecto de Supabase, abre **Edge Functions → Deploy a new function → Via Editor**. Crea estas
tres funciones con **exactamente** estos nombres, pegando el contenido completo de cada archivo:

| Nombre de la función | Archivo que pegas | Verificación JWT |
|---|---|---|
| `create-checkout` | `edge-create-checkout.ts` | Activada (por defecto) |
| `customer-portal` | `edge-customer-portal.ts` | Activada (por defecto) |
| `stripe-webhook` | `edge-stripe-webhook.ts` | **Desactivada** |

En `stripe-webhook`, abre su configuración (**Details** o **Settings**) y desactiva
**Enforce JWT verification** / **Verify JWT**. Stripe no envía sesión de usuario; la seguridad la da
la firma del aviso, que la función comprueba.

## 6. Añade los secretos

En **Edge Functions → Secrets** (o **Settings → Edge Functions**), añade:

| Nombre | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | la clave `sk_test_...` del paso 4 |
| `STRIPE_PRICE_PRO` | el ID `price_...` de Pro |
| `STRIPE_PRICE_BUSINESS` | el ID de Business (solo si lo creaste) |
| `APP_URL` | `https://TU_USUARIO.github.io/proposio/app.html` |
| `STRIPE_WEBHOOK_SECRET` | lo añades en el paso 7 |

## 7. Crea el webhook en Stripe

En **Desarrolladores → Webhooks → Añadir destino** (o «Añadir endpoint»):

- URL: `https://TU_PROYECTO.supabase.co/functions/v1/stripe-webhook`
- Eventos:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Guarda, copia el **secreto de firma** (`whsec_...`) y añádelo en Supabase como `STRIPE_WEBHOOK_SECRET`.

## 8. Actualiza la base de datos

En **SQL Editor**, pega de nuevo **todo** `supabase.sql` y pulsa **Run**. Añade la tabla de
suscripciones y los límites por plan; se puede ejecutar varias veces sin perder datos.

## 9. Completa las condiciones y activa los pagos en la web

1. Completa el aviso legal (NIF y domicilio en `legal.mjs`), redacta las condiciones de contratación y añade el proveedor de pagos a la Política de Privacidad.
   Revísalo con tu gestoría.
2. En `proposio-config.js`, cambia `enabled: false` por `enabled: true` dentro de `payments`.
   Revisa que los precios coinciden con los de Stripe y, si quieres, rellena `priceNote`
   (por ejemplo `'IVA incluido'`). Si creaste Business, pon también `business: { enabled: true, ... }`.
3. Commit changes y espera 1–2 minutos.

## 10. Prueba con una tarjeta de prueba

1. Entra en la app con tu cuenta. Las plantillas Moderna y Minimalista, el color, el logotipo y los
   textos guardados aparecen marcados como **Pro**.
2. Pulsa **Ver planes → Suscribirme a Pro**. Se abre la página de pago de Stripe.
3. Paga con la tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
4. Al volver, en unos segundos debe aparecer «¡Listo! Ya tienes el plan Pro» y el contador «de 30».
5. En **Mi cuenta → Planes y suscripción → Gestionar suscripción**, cancela la suscripción.
   Al volver debe poner «Cancelada: seguirás en Pro hasta…».

Si el plan no se activa, en Stripe → Webhooks abre el destino y mira si los avisos dan error.
Mándame el mensaje.

## 11. Paso a cobros reales

Solo cuando todo lo anterior funcione y hayas resuelto lo legal y fiscal (`LANZAMIENTO.md`):

1. Activa tu cuenta de Stripe en modo real. Stripe te pedirá verificar tu identidad y tus datos
   fiscales; esos datos los ve Stripe, no se publican en tu web.
2. Desactiva el modo de prueba y repite los pasos 2, 3, 4 y 7 en modo real (los productos, claves
   y webhooks de prueba y reales son distintos).
3. Sustituye en Supabase los secretos `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`,
   `STRIPE_PRICE_BUSINESS` y `STRIPE_WEBHOOK_SECRET` por los reales.
4. Haz una compra real tuya de Pro, comprueba que se activa y cancélala.

## Limitación conocida

El PDF se genera en el navegador. El servidor controla de forma fiable el contador y el plan de cada
cuenta, pero una persona con conocimientos técnicos podría generar un PDF sin pasar por la app.
Para un producto de este precio es un riesgo aceptable; si algún día fuese un problema, se puede
generar el PDF en el servidor.
