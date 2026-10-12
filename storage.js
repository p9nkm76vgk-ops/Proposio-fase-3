// Acceso seguro a localStorage.
// localStorage puede no estar disponible (modo privado, bloqueo de cookies, cuota llena),
// así que todas las operaciones están protegidas y nunca rompen la app.

export function readJSON(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Devuelve true si se guardó correctamente. */
export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
