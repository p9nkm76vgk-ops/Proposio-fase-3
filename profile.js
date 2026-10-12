// "Mis datos": tu nombre, contacto y diseño (plantilla, color y logotipo).
// Se guardan en este navegador y se aplican a cada propuesta nueva,
// para no tener que escribirlos ni configurarlos cada vez.

import { normalizeDesign } from './proposal.js'
import { readJSON, writeJSON } from './storage.js'

const PROFILE_KEY = 'proposio.profile.v1'

export function loadProfile() {
  const raw = readJSON(PROFILE_KEY)
  if (!raw || typeof raw !== 'object') return null
  return {
    professional: {
      name: typeof raw.professional?.name === 'string' ? raw.professional.name : '',
      contact: typeof raw.professional?.contact === 'string' ? raw.professional.contact : '',
    },
    design: normalizeDesign(raw.design),
  }
}

export function saveProfile(proposal) {
  return writeJSON(PROFILE_KEY, { professional: proposal.professional, design: proposal.design })
}
