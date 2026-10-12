# Activar las cuentas de usuario (Supabase)

Mientras no hagas estos pasos, proposio funciona sin cuentas, guardando todo en el navegador.
Todo se hace desde la web: no necesitas instalar nada ni volver a generar `app.html`.

**Coste: 0 €** con el plan gratuito de Supabase. Límites que conviene conocer:

- 500 MB de base de datos (de sobra para empezar).
- El proyecto se **pausa tras una semana sin actividad**; se reactiva desde el panel de Supabase.
- El correo que incluye Supabase solo envía a los miembros de tu equipo y unos 2 emails por hora.
  Sirve para que lo pruebes tú; para otros usuarios hay que conectar un correo propio (paso 8).

Revisa los límites actuales en la web de Supabase antes de lanzar: pueden cambiar.

---

## 1. Revisa los textos legales

Los textos legales se generan desde `legal.mjs` (titular, email de contacto y región del servidor).
Si cambias algo, edítalo ahí y ejecuta `npm run build`. Conviene que los revise un profesional antes de
abrir la app al público.

## 2. Crea el proyecto en Supabase

1. Entra en <https://supabase.com> y regístrate (puedes usar tu cuenta de GitHub).
2. Pulsa **New project**.
3. Nombre: `proposio`. Región: **Central EU (Frankfurt)**, para que los datos estén en la UE.
4. Escribe una contraseña para la base de datos y **guárdala** (no se la des a nadie).
5. Plan: **Free**. Pulsa **Create new project** y espera un par de minutos.

## 3. Crea las tablas y las reglas de seguridad

1. En el menú izquierdo, abre **SQL Editor** → **New query**.
2. Copia **todo** el contenido de `supabase.sql`, pégalo y pulsa **Run**.
3. Debe terminar con «Success. No rows returned». Si sale un error, cópiamelo.
4. Si actualizas proposio más adelante, vuelve a pegar y ejecutar `supabase.sql` completo: se puede repetir sin
   perder datos y añade lo nuevo (por ejemplo, la tabla de propuestas enviadas por enlace).

## 4. Configura las direcciones de la web

En **Authentication → URL Configuration**:

- **Site URL**: la dirección de la app, por ejemplo `https://TU_USUARIO.github.io/proposio/app.html`
- **Redirect URLs** → **Add URL**: añade la misma dirección.
  Si algún día trabajas en local, añade también `http://localhost:5173/dev.html`.

Así el enlace del email te devuelve a tu web y no a otra.

## 5. (Opcional) Traduce el email de acceso

En **Authentication → Emails → Magic Link**, cambia el asunto y el texto. Ejemplo:

- Asunto: `Tu enlace para entrar en proposio`
- Cuerpo:

```html
<h2>Entra en proposio</h2>
<p>Pulsa este enlace para entrar. Caduca en una hora y solo se puede usar una vez.</p>
<p><a href="{{ .ConfirmationURL }}">Entrar en proposio</a></p>
<p>Si no has pedido este enlace, ignora este mensaje.</p>
```

Haz lo mismo en la plantilla **Confirm signup** (es la que reciben las personas nuevas).

## 6. Copia las claves públicas

En **Project Settings → API** (o **API Keys**):

- **Project URL** → algo como `https://abcd1234.supabase.co`
- **anon public** (o **publishable**) → una clave larga

⚠️ **No copies nunca la clave `service_role` o `secret`.** Esa da acceso total a la base de datos.
proposio la detecta y se niega a usarla, pero si la publicaras en GitHub tendrías que regenerarla.

## 7. Pégalas en proposio-config.js

1. En GitHub, abre `proposio-config.js` y pulsa el lápiz (**Edit this file**).
2. Rellena los dos valores entre las comillas:

```js
window.PROPOSIO_CONFIG = {
  supabaseUrl: 'https://abcd1234.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
}
```

3. Pulsa **Commit changes**. En 1–2 minutos la web se actualiza.

## 8. Correo para usuarios reales (antes de invitar a nadie)

El correo incluido en Supabase solo llega a los miembros de tu equipo. Para que funcione con
cualquier email, conecta un servicio de correo en **Authentication → Emails → SMTP Settings**.
Opciones con plan gratuito (comprueba sus condiciones actuales):

- **Brevo**: plan gratuito con un número limitado de emails al día.
- **Resend**: plan gratuito mensual; exige verificar un dominio propio.

Para que los emails no acaben en spam lo ideal es un **dominio propio** (aprox. 10–15 € al año).
No lo compres todavía: primero prueba la app tú mismo con tu email.

## 9. Prueba

1. Abre la app (`app.html`): en la cabecera debe aparecer **Entrar**.
2. Escribe tu email (el de tu cuenta de Supabase), acepta la privacidad y pulsa **Enviar enlace**.
3. Abre el enlace del email **en el mismo navegador**. Debes volver a proposio con la sesión iniciada.
4. Escribe una propuesta: arriba debe poner «Guardado en tu cuenta».
5. Abre la web en otro navegador o en el móvil, entra con el mismo email y comprueba que tu
   propuesta aparece en **Mis propuestas**.

6. Pulsa **Enviar al cliente**, copia el enlace y ábrelo en otro navegador (o en modo incógnito): debes ver la
   propuesta. Acéptala con un nombre de prueba. Vuelve a la app y recarga: debe aparecer el aviso de aceptación.

Si algo falla, abre la consola del navegador (F12 → Consola) y mándame el mensaje en rojo.


## 10. Entrar con Google (recomendado: sin límite de emails)

El email de acceso gratuito de Supabase solo permite **unos pocos envíos por hora en todo el proyecto**.
Con «Continuar con Google» no se envía ningún email, así que ese límite deja de afectar a quien entre así.
Es gratis.

**En Google Cloud** (https://console.cloud.google.com, con tu cuenta de Google):

1. Crea un proyecto nuevo, por ejemplo «proposio».
2. Abre **Google Auth Platform** y completa **Branding** (nombre «proposio», tu email de contacto) y
   **Audience** (tipo **External**). Puedes publicarla sin verificar: los usuarios verán un aviso de
   Google la primera vez; la verificación (gratuita, tarda unos días) lo quita.
3. En **Data Access** deja los permisos básicos: `openid`, email y perfil. No añadas otros.
4. En **Clients → Create client**, tipo **Web application**:
   - **Authorized JavaScript origins**: `https://p9nkm76vgk-ops.github.io`
   - **Authorized redirect URIs**: `https://lyovhyfnhurjdoepnnte.supabase.co/auth/v1/callback`
5. Copia el **Client ID** y el **Client secret**. El secret es SECRETO: no lo pegues en GitHub ni en
   `proposio-config.js`.

**En Supabase:**

6. **Authentication → Sign In / Providers → Google**: activa **Enable**, pega el Client ID y el Client
   secret y guarda.
7. Comprueba que en **Authentication → URL Configuration → Redirect URLs** está la dirección de la app
   (`https://p9nkm76vgk-ops.github.io/Proposio-fase-3/app.html`).

**En GitHub:**

8. Edita `proposio-config.js` y cambia `googleLogin: false` por `googleLogin: true`. Guarda (Commit).
   En un par de minutos aparecerá **Continuar con Google** en la ventana de entrar.

## 11. Email propio sin coste: una cuenta de Gmail dedicada

Sirve para dos cosas: los enlaces de acceso por email (sin el límite por hora del servicio de prueba de
Supabase) y el aviso «tu cliente ha aceptado». Es gratis; Gmail permite unos 500 envíos al día, de sobra
para empezar. Cuando crezcas, se cambia por un servicio profesional (Brevo, Resend…) con dominio propio.

1. Crea una cuenta de Gmail nueva solo para esto, por ejemplo `proposio.avisos@gmail.com`
   (así no usas tu email personal).
2. En esa cuenta, activa la **verificación en dos pasos** (myaccount.google.com → Seguridad).
3. En myaccount.google.com/apppasswords crea una **contraseña de aplicación** llamada «proposio».
   Google te enseña 16 letras: esa es la contraseña SMTP. No es la contraseña normal de la cuenta.

**Enlaces de acceso:** Supabase → **Authentication → Emails → SMTP Settings** → activa **Custom SMTP**:
- Sender email: la dirección de Gmail · Sender name: `proposio`
- Host: `smtp.gmail.com` · Port: `465` · Username: la dirección de Gmail · Password: la contraseña de aplicación

Después, en **Authentication → Rate Limits**, sube «Rate limit for sending emails» (por ejemplo, a 100 por hora).

## 12. Aviso por email cuando un cliente acepta

La base de datos ya está preparada (supabase.sql). Falta publicar la función y darle la contraseña:

1. Supabase → **Edge Functions → Deploy a new function → Via Editor**, nombre `notify-acceptance`.
   Pega el contenido de `edge-notify-acceptance.ts` y despliega. En sus ajustes, **desactiva «Verify JWT»**.
2. **Edge Functions → Secrets**: añade `SMTP_USER` (la dirección de Gmail), `SMTP_PASS` (la contraseña de
   aplicación) y `APP_URL` (la dirección de tu app).
3. **SQL Editor**, una sola vez:
   `select vault.create_secret('https://TU_PROYECTO.supabase.co/functions/v1', 'proposio_functions_url');`

Mientras falte algo, no se envía nada y la aceptación funciona igual.

## 13. Más adelante: servicio de email profesional y dominio

Opciones con plan gratuito (comprueba sus condiciones actuales antes de elegir):

- **Brevo**: unos 300 emails al día gratis.
- **Resend**: unos 100 emails al día y 3.000 al mes gratis.

Ambos piden verificar un **dominio propio** (aprox. 10–15 € al año) para enviar a cualquier persona con
buena entrega. Cuando el volumen crezca, sus planes de pago empiezan en torno a 9–20 $ al mes.
