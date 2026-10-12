// Borrador de la propuesta actual, guardado solo en este navegador.
// No se envía a ningún servidor.

import { normalizeProposal } from './proposal.js'
import { readJSON, writeJSON } from './storage.js'

const DRAFT_KEY = 'proposio.draft.v1'

export function loadDraft() {
  return normalizeProposal(readJSON(DRAFT_KEY))
}

export function saveDraft(proposal) {
  return writeJSON(DRAFT_KEY, proposal)
}

/** Borra el borrador de este navegador (al cerrar sesión). */
export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // sin acceso al almacenamiento: no hay nada que borrar
  }
}
