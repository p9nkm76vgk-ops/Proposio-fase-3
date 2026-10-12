# Activar las cuentas de usuario (Supabase)

Mientras no hagas estos pasos, proposio funciona sin cuentas, guardando todo en el navegador.
Todo se hace desde la web: no necesitas instalar nada ni volver a generar `index.html`.

**Coste: 0 €** con el plan gratuito de Supabase. Límites que conviene conocer:

- 500 MB de base de datos (de sobra para empezar).
- El proyecto se **pausa tras una semana sin actividad**; se reactiva desde el panel de Supabase.
- El correo que incluye Supabase solo envía a los miembros de tu equipo y unos 2 emails por hora.
  Sirve para que lo pruebes tú; para otros usuarios hay que conectar un correo propio (paso 8).

Revisa los límites actuales en la web de Supabase antes de lanzar: pueden cambiar.

---

## 1. Completa la política de privacidad

Abre `privacidad.html` y sustituye todos los textos `[COMPLETAR]` (tu nombre o empresa, NIF,
domicilio, email de contacto, fecha y región del servidor). Después borra el aviso amarillo de
«Borrador». Conviene que la revise un profesional antes de abrir la app al público.

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

## 4. Configura las direcciones de la web

En **Authentication → URL Configuration**:

- **Site URL**: la dirección de tu web, por ejemplo `https://TU_USUARIO.github.io/proposio/`
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

1. Abre tu web: en la cabecera debe aparecer **Entrar**.
2. Escribe tu email (el de tu cuenta de Supabase), acepta la privacidad y pulsa **Enviar enlace**.
3. Abre el enlace del email **en el mismo navegador**. Debes volver a proposio con la sesión iniciada.
4. Escribe una propuesta: arriba debe poner «Guardado en tu cuenta».
5. Abre la web en otro navegador o en el móvil, entra con el mismo email y comprueba que tu
   propuesta aparece en **Mis propuestas**.

Si algo falla, abre la consola del navegador (F12 → Consola) y mándame el mensaje en rojo.
