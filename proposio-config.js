// ─────────────────────────────────────────────────────────────────────────────
// Configuración de proposio. Puedes editar este archivo directamente en GitHub:
// no hace falta volver a generar app.html.
//
// 1) Cuentas de usuario (Supabase): mientras los dos valores estén vacíos, proposio
//    funciona sin cuentas y guarda todo en el navegador. Guía: CONFIGURAR-CUENTAS.md
//      supabaseUrl:     la URL del proyecto, p. ej. 'https://abcd1234.supabase.co'
//      supabaseAnonKey: la clave pública "anon" o "publishable"
//    Estas claves son PÚBLICAS por diseño. NUNCA pegues aquí la clave "service_role"
//    o "secret": da acceso total a la base de datos.
//
// 2) Pagos (Stripe): solo funcionan con las cuentas activadas. Guía: CONFIGURAR-PAGOS.md
//      enabled: true cuando hayas terminado la guía de pagos.
//      Los precios de aquí solo se MUESTRAN: lo que se cobra es el precio configurado en
//      Stripe. Mantén los dos iguales.
//      priceNote: aclaración sobre impuestos, según como lo configures en Stripe
//      (p. ej. 'IVA incluido'). Si vendes a consumidores, el precio mostrado debe ser el final.
// ─────────────────────────────────────────────────────────────────────────────
window.PROPOSIO_CONFIG = {
  supabaseUrl: 'https://lyovhyfnhurjdoepnnte.supabase.co',
  supabaseAnonKey: 'sb_publishable_x3GrXuxI4vPXhozKGGIu8w_EE6CuB5q',

  // Botón «Continuar con Google». Ponlo en true SOLO cuando hayas activado Google en
  // Supabase (Authentication → Sign In / Providers → Google). Ver CONFIGURAR-CUENTAS.md.
  googleLogin: true,

  payments: {
    enabled: false,
    priceNote: '',
    pro: { price: '7,90 €', period: 'al mes' },
    business: { enabled: false, price: '14,90 €', period: 'al mes' },
  },
}
