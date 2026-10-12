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

/**
 * Datos del usuario que viven en este navegador (sin cuenta) o en su cuenta (con sesión).
 * - useLocal(): lee y escribe en localStorage.
 * - useCloud(inicial, onWrite): guarda en memoria y envía cada cambio a la cuenta con onWrite.
 */
export function createSyncedStore(localKey, emptyValue) {
  const local = {
    read: () => readJSON(localKey),
    write: (value) => writeJSON(localKey, value),
  }
  let current = local
  return {
    read: () => current.read() ?? emptyValue,
    write: (value) => current.write(value),
    readLocal: () => local.read() ?? emptyValue,
    useLocal() {
      current = local
    },
    useCloud(initial, onWrite) {
      let memory = initial ?? emptyValue
      current = {
        read: () => memory,
        write: (value) => {
          memory = value
          onWrite(value)
          return true
        },
      }
    },
  }
}
