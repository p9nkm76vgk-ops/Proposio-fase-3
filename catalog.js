// Catálogo de servicios: conceptos con su precio que el usuario guarda una vez
// y añade a cualquier propuesta con un clic (por ejemplo, «Sesión de fotos · 1 h · 90 €»).
// Se guarda en este navegador o, con sesión, en tu cuenta (columna profiles.catalog).

import { createId, createPriceItem } from './proposal.js'
import { createSyncedStore } from './storage.js'

export const MAX_CATALOG_ITEMS = 100
export const catalogStore = createSyncedStore('proposio.catalog.v1', [])

const str = (v) => (typeof v === 'string' ? v : '')

/** Limpia una lista guardada (descarta elementos dañados). */
export function normalizeCatalog(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i) => i && typeof i === 'object' && str(i.concept).trim() !== '')
    .slice(0, MAX_CATALOG_ITEMS)
    .map((i) => ({
      id: str(i.id) || createId(),
      concept: str(i.concept).trim(),
      unitPrice: str(i.unitPrice).trim(),
      quantity: str(i.quantity).trim() || '1',
    }))
}

export function loadCatalog() {
  return normalizeCatalog(catalogStore.read())
}

/** Guarda una línea de precio en el catálogo. Devuelve { ok, list, reason } */
export function addToCatalog(item) {
  const list = loadCatalog()
  const concept = str(item.concept).trim()
  if (!concept) return { ok: false, list, reason: 'empty' }
  const same = (i) => i.concept.toLowerCase() === concept.toLowerCase() && i.unitPrice === str(item.unitPrice).trim()
  if (list.some(same)) return { ok: false, list, reason: 'duplicate' }
  if (list.length >= MAX_CATALOG_ITEMS) return { ok: false, list, reason: 'full' }
  const next = [
    { id: createId(), concept, unitPrice: str(item.unitPrice).trim(), quantity: str(item.quantity).trim() || '1' },
    ...list,
  ]
  return catalogStore.write(next) ? { ok: true, list: next } : { ok: false, list, reason: 'storage' }
}

export function removeFromCatalog(id) {
  const next = loadCatalog().filter((i) => i.id !== id)
  catalogStore.write(next)
  return next
}

/** Nueva línea de precio (con id propio) a partir de un elemento del catálogo. */
export function priceItemFromCatalog(entry) {
  return createPriceItem(entry.concept, entry.unitPrice, entry.quantity || '1')
}
