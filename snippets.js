// Textos habituales: condiciones de pago, exclusiones, plazos... que el usuario
// guarda una vez y reutiliza en otras propuestas. Se guardan en este navegador
// o, si has entrado en tu cuenta, en la nube.

import { createId } from './proposal.js'
import { readJSON, writeJSON } from './storage.js'

const SNIPPETS_KEY = 'proposio.snippets.v1'
export const MAX_SNIPPETS_PER_FIELD = 10

/** Campos que admiten textos guardados y su nombre para mostrar. */
export const SNIPPET_FIELDS = {
  service: 'servicio',
  timeline: 'plazos',
  paymentTerms: 'condiciones de pago',
  revisions: 'revisiones',
  exclusions: 'exclusiones',
  nextSteps: 'próximos pasos',
}

// Dónde se guardan: en este navegador (sin cuenta) o en tu cuenta (con sesión).
const localStore = {
  read: () => readJSON(SNIPPETS_KEY),
  write: (all) => writeJSON(SNIPPETS_KEY, all),
}
let store = localStore

/** Sin sesión: textos guardados en este navegador. */
export function setLocalSnippetStore() {
  store = localStore
}

/**
 * Con sesión: los textos viven en memoria y cada cambio se envía a la cuenta
 * mediante onWrite(todos). `initial` son los textos que ya había en la cuenta.
 */
export function setCloudSnippetStore(initial, onWrite) {
  let memory = initial && typeof initial === 'object' ? { ...initial } : {}
  store = {
    read: () => memory,
    write: (all) => {
      memory = all
      onWrite(all)
      return true
    },
  }
}

function readAll() {
  const raw = store.read()
  return raw && typeof raw === 'object' ? { ...raw } : {}
}

export function loadSnippets(field) {
  const list = readAll()[field]
  if (!Array.isArray(list)) return []
  return list.filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string' && s.text.trim() !== '')
}

function saveField(field, list) {
  const all = readAll()
  all[field] = list
  return store.write(all)
}

/** Guarda un texto. Devuelve { ok, list, reason } */
export function addSnippet(field, text) {
  const value = text.trim()
  const list = loadSnippets(field)
  if (!value) return { ok: false, list, reason: 'empty' }
  if (list.some((s) => s.text.trim() === value)) return { ok: false, list, reason: 'duplicate' }
  if (list.length >= MAX_SNIPPETS_PER_FIELD) return { ok: false, list, reason: 'full' }
  const next = [{ id: createId(), text: value }, ...list]
  return saveField(field, next) ? { ok: true, list: next } : { ok: false, list, reason: 'storage' }
}

export function removeSnippet(field, id) {
  const next = loadSnippets(field).filter((s) => s.id !== id)
  saveField(field, next)
  return next
}

/** Textos guardados en este navegador (para copiarlos a la cuenta al entrar por primera vez). */
export function readLocalSnippets() {
  const raw = localStore.read()
  return raw && typeof raw === 'object' ? raw : {}
}
