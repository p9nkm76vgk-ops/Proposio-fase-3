// Componente principal: guarda el estado de la propuesta y coordina formulario,
// vista previa, guardado (navegador o cuenta), límite mensual y exportación a PDF.
//
// Dos modos:
//   - Sin cuenta: todo se guarda en este navegador (borrador, tus datos, textos guardados)
//     y el límite mensual es un control provisional local.
//   - Con cuenta (Supabase configurado y sesión iniciada): las propuestas se guardan
//     solas en la cuenta, hay historial en «Mis propuestas» y el servidor aplica el límite.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountDialog, LoginDialog, ProposalsDialog } from './AccountDialogs.jsx'
import { AppHeader } from './AppHeader.jsx'
import { DashboardDialog } from './DashboardDialog.jsx'
import { PlansDialog } from './PlansDialog.jsx'
import { ShareDialog, shareStatusText } from './ShareDialog.jsx'
import { Modal, Toast } from './Feedback.jsx'
import { ProposalForm } from './ProposalForm.jsx'
import { ProposalPreview } from './ProposalPreview.jsx'
import * as cloud from './cloud.js'
import { PAYMENTS } from './config.js'
import { PLAN_LABELS, applyEntitlements, getEntitlements, isPaidPlan } from './entitlements.js'
import { catalogStore, normalizeCatalog } from './catalog.js'
import { buildDocument } from './document.js'
import { clearDraft, loadDraft, saveDraft } from './drafts.js'
import { downloadProposalPdf } from './pdf.js'
import { pricingSummary } from './pricing.js'
import { rateStore } from './rate.js'
import { loadProfile, saveProfile } from './profile.js'
import { createEmptyProposal, duplicateProposal, hasUserContent, setIn } from './proposal.js'
import { SAMPLE_PROFESSIONS, createProfessionSample } from './samples.js'
import { acceptanceToast, isShareOutdated, markAcceptancesSeen, needsFollowUp, newAcceptances } from './sharing.js'
import { readLocalSnippets, setCloudSnippetStore, setLocalSnippetStore } from './snippets.js'
import { getUsage, registerExport } from './usage.js'
import { fieldIdFromPath, validateProposal } from './validation.js'

const CLOUD_SAVE_DELAY = 1200
const SHARES_REFRESH_MIN_MS = 60 * 1000 // como mucho, una consulta por minuto al volver a la pestaña

/** Combina una respuesta de uso con lo ya conocido: si no trae plan o suscripción, se conservan. */
function mergeUsage(prev, next) {
  return {
    ...next,
    plan: next.plan ?? prev?.plan ?? 'free',
    subscription: next.subscription === undefined ? (prev?.subscription ?? null) : next.subscription,
  }
}

export default function App() {
  const [proposal, setProposal] = useState(() => loadDraft() ?? createEmptyProposal(loadProfile() ?? {}))
  const [touched, setTouched] = useState(() => new Set())
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [activeTab, setActiveTab] = useState('edit') // solo se usa en móvil
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)
  const [dialog, setDialog] = useState(null) // { kind: 'confirm' | 'limit' | 'login' | 'proposals' | 'account', ... }
  const [usageVersion, setUsageVersion] = useState(0)
  const [draftSaved, setDraftSaved] = useState(true)

  // Cuenta
  const [account, setAccount] = useState(null) // { userId, email } | null
  const [profileReadyFor, setProfileReadyFor] = useState(null) // userId cuyo perfil ya se cargó
  const [cloudSave, setCloudSave] = useState('idle') // idle | pending | saving | saved | error
  const [cloudUsage, setCloudUsage] = useState(null)
  const [formKey, setFormKey] = useState(0) // remonta el formulario al cambiar de modo (textos guardados)

  // Envío por enlace
  const [shareState, setShareState] = useState({ proposalId: null, share: null }) // enlace de la propuesta abierta
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState(null)
  const [shares, setShares] = useState([]) // todos los enlaces (avisos, «Mis propuestas» y panel)
  const [sharesLoading, setSharesLoading] = useState(false)

  const proposalRef = useRef(proposal)
  const accountRef = useRef(account)
  const lastSavedRef = useRef(null) // JSON de la última versión guardada en la cuenta
  const sharesFetchedAt = useRef(0)
  const savingRef = useRef(Promise.resolve())
  const hadAccountAtStart = useRef(null)
  proposalRef.current = proposal
  accountRef.current = account

  const localUsage = useMemo(() => getUsage(proposal.id), [proposal.id, usageVersion])
  const usage = account
    ? (cloudUsage ?? { used: 0, limit: 0, remaining: 0, alreadyCounted: false, canExport: true, loading: true })
    : localUsage

  // Plan y funciones disponibles (sin pagos activados, todo está disponible)
  const plan = account ? (cloudUsage?.plan ?? 'free') : 'free'
  const entitlements = useMemo(() => getEntitlements(plan, PAYMENTS.enabled), [plan])
  // Lo que se muestra y se descarga respeta el plan; lo guardado no se toca
  const outputProposal = useMemo(() => applyEntitlements(proposal, entitlements), [proposal, entitlements])
  const model = useMemo(() => buildDocument(outputProposal), [outputProposal])
  // Se valida lo que se va a descargar o enviar (sin lo que tu plan no incluye)
  const errors = useMemo(() => validateProposal(outputProposal), [outputProposal])
  const errorCount = Object.keys(errors).length
  const openPlans = useCallback(() => setDialog({ kind: 'plans' }), [])

  // ─── Copia local (siempre) ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDraftSaved(saveDraft(proposal))
      if (!accountRef.current) saveProfile(proposal) // sin cuenta: tus datos y diseño en este navegador
    }, 400)
    return () => clearTimeout(timer)
  }, [proposal])

  // ─── Sesión ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cloud.cloudEnabled) return undefined
    let active = true
    let unsubscribe = () => {}
    const apply = (next) => setAccount((prev) => (prev?.userId === next?.userId ? prev : next))
    cloud
      .getAccount()
      .then((a) => {
        if (!active) return
        hadAccountAtStart.current = Boolean(a)
        apply(a)
      })
      .catch((err) => active && setToast({ type: 'error', message: err.userMessage }))
    cloud
      .onAccountChange((a) => active && apply(a))
      .then((unsub) => {
        unsubscribe = unsub
        if (!active) unsub()
      })
      .catch(() => {})
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Al entrar: cargar tu perfil de la cuenta (o crearlo con lo que hay en este navegador)
  useEffect(() => {
    if (!account) {
      setLocalSnippetStore()
      catalogStore.useLocal()
      rateStore.useLocal()
      setCloudUsage(null)
      setProfileReadyFor(null)
      setFormKey((k) => k + 1)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const profile = await cloud.fetchProfile()
        if (cancelled) return
        const current = proposalRef.current
        let snippets = profile?.snippets
        let catalog = profile?.catalog
        let pricingSettings = profile?.pricingSettings
        if (!profile) {
          // Primera vez con esta cuenta: se copian tus datos, diseño, textos, catálogo y tarifa de este navegador
          snippets = readLocalSnippets()
          catalog = normalizeCatalog(catalogStore.readLocal())
          pricingSettings = rateStore.readLocal()
          await cloud.saveProfile(account, {
            professional: current.professional,
            design: current.design,
            snippets,
            catalog,
            pricing_settings: pricingSettings,
          })
        } else if (!hasUserContent(current)) {
          setProposal((prev) => ({ ...prev, professional: profile.professional, design: profile.design }))
        }
        setCloudSnippetStore(snippets ?? {}, (all) => {
          cloud
            .saveProfile(account, { snippets: all })
            .catch((err) => setToast({ type: 'error', message: err.userMessage }))
        })
        const reportError = (err) => setToast({ type: 'error', message: err.userMessage })
        catalogStore.useCloud(catalog ?? [], (all) => cloud.saveProfile(account, { catalog: all }).catch(reportError))
        rateStore.useCloud(pricingSettings ?? {}, (all) => cloud.saveProfile(account, { pricing_settings: all }).catch(reportError))
        setFormKey((k) => k + 1)
        setProfileReadyFor(account.userId)
        if (hadAccountAtStart.current === false) {
          setToast({ type: 'success', message: `Has entrado como ${account.email}. Tus propuestas se guardarán en tu cuenta.` })
        }
        hadAccountAtStart.current = true
      } catch (err) {
        if (!cancelled) setToast({ type: 'error', message: err.userMessage ?? 'No se pudieron cargar tus datos.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account])

  // ─── Guardado automático en la cuenta ─────────────────────────────────────
  /** Guarda la propuesta actual si ha cambiado. Rechaza si falla (para la exportación). */
  const flushCloudSave = useCallback(() => {
    const run = async () => {
      const acc = accountRef.current
      const current = proposalRef.current
      if (!acc || !hasUserContent(current)) return
      const json = JSON.stringify(current)
      if (json === lastSavedRef.current) return
      setCloudSave('saving')
      try {
        await cloud.saveProposal(acc, current)
        lastSavedRef.current = json
        setCloudSave(JSON.stringify(proposalRef.current) === json ? 'saved' : 'pending')
      } catch (err) {
        setCloudSave('error')
        throw err
      }
    }
    // En cola: nunca hay dos guardados a la vez
    savingRef.current = savingRef.current.catch(() => {}).then(run)
    return savingRef.current
  }, [])

  useEffect(() => {
    if (!account || profileReadyFor !== account.userId || !hasUserContent(proposal)) return undefined
    if (JSON.stringify(proposal) === lastSavedRef.current) {
      // Se deshizo un cambio antes de guardarlo: vuelve a coincidir con lo guardado
      setCloudSave((prev) => (prev === 'pending' ? 'saved' : prev))
      return undefined
    }
    setCloudSave('pending')
    const timer = setTimeout(() => flushCloudSave().catch(() => {}), CLOUD_SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [proposal, account, profileReadyFor, flushCloudSave])

  // Tus datos y diseño en la cuenta (para las próximas propuestas)
  const profileJson = JSON.stringify({ professional: proposal.professional, design: proposal.design })
  useEffect(() => {
    if (!account || profileReadyFor !== account.userId) return undefined
    const timer = setTimeout(() => {
      const { professional, design } = JSON.parse(profileJson)
      cloud.saveProfile(account, { professional, design }).catch(() => {})
    }, CLOUD_SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [profileJson, account, profileReadyFor])

  // Contador mensual del servidor
  useEffect(() => {
    if (!account) return undefined
    let cancelled = false
    cloud
      .fetchUsage(proposal.id)
      .then((u) => !cancelled && setCloudUsage((prev) => mergeUsage(prev, u)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [account, proposal.id, usageVersion])

  // Enlace de la propuesta abierta (si se envió)
  const currentShare = account && shareState.proposalId === proposal.id ? shareState.share : null
  useEffect(() => {
    if (!account) return undefined
    let cancelled = false
    cloud
      .getShare(proposal.id, { withSnapshot: true })
      .then((share) => !cancelled && setShareState({ proposalId: proposal.id, share }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [account, proposal.id])

  // Todos los enlaces: avisa de las propuestas aceptadas desde la última vez
  const refreshShares = useCallback(async ({ force = false } = {}) => {
    const acc = accountRef.current
    if (!acc) return
    if (!force && Date.now() - sharesFetchedAt.current < SHARES_REFRESH_MIN_MS) return
    sharesFetchedAt.current = Date.now()
    setSharesLoading(true)
    try {
      const list = await cloud.listShares()
      if (accountRef.current?.userId !== acc.userId) return
      setShares(list)
      const fresh = newAcceptances(list, acc.userId)
      if (fresh.length) {
        markAcceptancesSeen(fresh, acc.userId)
        setToast({ type: 'success', message: acceptanceToast(fresh) })
        // Si la propuesta abierta es una de ellas, se actualiza su estado
        const open = fresh.find((sh) => sh.proposalId === proposalRef.current.id)
        if (open) setShareState((prev) => (prev.proposalId === open.proposalId ? { ...prev, share: { ...prev.share, ...open, snapshot: prev.share?.snapshot ?? null } } : prev))
      }
    } catch {
      // Sin conexión: se intentará en la próxima visita a la pestaña
    } finally {
      setSharesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!account || profileReadyFor !== account.userId) {
      setShares([])
      return undefined
    }
    refreshShares({ force: true })
    const onFocus = () => document.visibilityState === 'visible' && refreshShares()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [account, profileReadyFor, refreshShares])

  // Vuelta desde la página de pago de Stripe (?pago=ok | ?pago=cancelado)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('pago')
    if (!result) return
    params.delete('pago')
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', clean)
    if (result === 'cancelado') setToast({ type: 'success', message: 'Pago cancelado. No se ha cobrado nada.' })
    if (result === 'ok') {
      setToast({ type: 'success', message: 'Pago completado. Estamos activando tu plan…' })
      sessionStorage.setItem('proposio.awaitingPlan', '1')
    }
  }, [])

  // Tras pagar, el plan se activa cuando Stripe avisa al servidor (unos segundos)
  useEffect(() => {
    if (!account || !sessionStorage.getItem('proposio.awaitingPlan')) return undefined
    if (isPaidPlan(cloudUsage?.plan)) {
      sessionStorage.removeItem('proposio.awaitingPlan')
      setToast({ type: 'success', message: `¡Listo! Ya tienes el plan ${PLAN_LABELS[cloudUsage.plan]}.` })
      return undefined
    }
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      setUsageVersion((v) => v + 1)
      if (attempts >= 10) {
        clearInterval(timer)
        sessionStorage.removeItem('proposio.awaitingPlan')
        setToast({ type: 'error', message: 'El pago está hecho, pero el plan aún no aparece. Recarga la página en un minuto.' })
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [account, cloudUsage?.plan])

  // ─── Utilidades de la interfaz ────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0 })
  }

  const closeToast = useCallback(() => setToast(null), [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const handleFieldChange = useCallback((path, value) => {
    setProposal((prev) => setIn(prev, path.split('.'), value))
  }, [])

  const handleBlur = useCallback((path) => {
    setTouched((prev) => (prev.has(path) ? prev : new Set(prev).add(path)))
  }, [])

  const errorFor = useCallback(
    (path) => (showAllErrors || touched.has(path) ? errors[path] : undefined),
    [errors, showAllErrors, touched],
  )

  const resetWith = (next, message, { alreadySaved = false } = {}) => {
    setProposal(next)
    lastSavedRef.current = alreadySaved ? JSON.stringify(next) : null
    setCloudSave(alreadySaved ? 'saved' : 'idle')
    setTouched(new Set())
    setShowAllErrors(false)
    setActiveTab('edit')
    setDialog(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (message) setToast({ type: 'success', message })
  }

  /**
   * Antes de sustituir la propuesta actual:
   *   - con cuenta: se guarda y se sigue (queda en «Mis propuestas»);
   *   - sin cuenta, o si falla el guardado: se pide confirmación.
   */
  const replaceCurrent = async (title, message, confirmLabel, action) => {
    if (!hasUserContent(proposal)) {
      action()
      return
    }
    if (account) {
      try {
        await flushCloudSave()
        action()
        return
      } catch {
        setDialog({
          kind: 'confirm',
          title,
          message: 'No se pudo guardar la propuesta actual en tu cuenta. Si continúas, se perderán los últimos cambios.',
          confirmLabel,
          onConfirm: action,
        })
        return
      }
    }
    setDialog({ kind: 'confirm', title, message, confirmLabel, onConfirm: action })
  }

  const handleNew = () =>
    replaceCurrent(
      '¿Empezar una propuesta nueva?',
      'Se borrará el contenido actual del borrador. Se conservarán tus datos (nombre y contacto) y el diseño elegido.',
      'Empezar nueva',
      () =>
        resetWith(
          createEmptyProposal({ professional: proposalRef.current.professional, design: proposalRef.current.design }),
          accountRef.current ? 'Nueva propuesta lista. La anterior está en «Mis propuestas».' : 'Nueva propuesta lista.',
        ),
    )

  const handleSample = () => setDialog({ kind: 'sample' })

  const loadSample = (professionId) =>
    replaceCurrent(
      '¿Cargar la propuesta de ejemplo?',
      'Se sustituirá el contenido actual del borrador por datos de ejemplo ficticios.',
      'Cargar ejemplo',
      () =>
        resetWith(
          createProfessionSample(professionId, proposalRef.current.design),
          'Ejemplo cargado. Cambia los datos por los tuyos antes de enviarlo.',
        ),
    )

  const handleDuplicate = async () => {
    if (!hasUserContent(proposal)) {
      setToast({ type: 'error', message: 'No hay nada que duplicar todavía: escribe o carga una propuesta primero.' })
      return
    }
    if (account) await flushCloudSave().catch(() => {})
    resetWith(duplicateProposal(proposalRef.current), 'Copia creada. Contará como propuesta nueva cuando la descargues.')
  }

  const focusFirstError = () => {
    const firstPath = Object.keys(errors)[0]
    if (!firstPath) return
    setActiveTab('edit')
    // Espera a que se muestre la pestaña de edición en móvil antes de enfocar.
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldIdFromPath(firstPath))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus({ preventScroll: true })
      }
    })
  }

  /** ¿Está completa la propuesta? Si no, muestra los errores y devuelve false. */
  const checkReady = () => {
    if (errorCount === 0) return true
    setShowAllErrors(true)
    setToast({
      type: 'error',
      message:
        errorCount === 1
          ? 'Falta 1 dato obligatorio o hay un valor no válido.'
          : `Faltan datos obligatorios o hay valores no válidos (${errorCount}).`,
    })
    focusFirstError()
    return false
  }

  // ─── Exportar ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return
    if (!checkReady()) return

    setExporting(true)
    try {
      if (account) {
        // Con cuenta: el servidor decide si se puede descargar
        await flushCloudSave()
        const result = await cloud.registerExport(proposal.id)
        setCloudUsage((prev) => mergeUsage(prev, result.usage))
        if (!result.allowed) {
          setDialog({ kind: 'limit' })
          return
        }
        await downloadProposalPdf(outputProposal)
        setToast({ type: 'success', message: 'PDF generado. Revisa tu carpeta de descargas.' })
      } else {
        if (!localUsage.canExport) {
          setDialog({ kind: 'limit' })
          return
        }
        await downloadProposalPdf(outputProposal)
        const stored = registerExport(proposal.id)
        setUsageVersion((v) => v + 1)
        setToast({
          type: 'success',
          message: stored
            ? 'PDF generado. Revisa tu carpeta de descargas.'
            : 'PDF generado, pero no se pudo guardar el contador en este navegador.',
        })
      }
    } catch (error) {
      console.error('Error al exportar', error)
      setToast({ type: 'error', message: error?.userMessage ?? 'No se pudo generar el PDF. Inténtalo de nuevo.' })
    } finally {
      setExporting(false)
    }
  }

  // ─── Enviar al cliente por enlace ─────────────────────────────────────────
  /** Crea el enlace o lo actualiza con la versión actual. Cuenta en el cupo igual que descargar. */
  const publishShare = async () => {
    const acc = accountRef.current
    if (!acc || shareBusy) return
    const id = proposalRef.current.id
    setShareBusy(true)
    setShareError(null)
    try {
      await flushCloudSave()
      const result = await cloud.registerExport(id)
      setCloudUsage((prev) => mergeUsage(prev, result.usage))
      if (!result.allowed) {
        setDialog({ kind: 'limit' })
        return
      }
      const share = await cloud.shareProposal(acc, outputProposal, pricingSummary(outputProposal))
      setShareState({ proposalId: id, share })
      refreshShares({ force: true })
    } catch (err) {
      setShareError(err?.userMessage ?? 'No se pudo preparar el enlace. Inténtalo de nuevo.')
    } finally {
      setShareBusy(false)
    }
  }

  const handleShare = () => {
    if (!account) {
      setDialog({ kind: 'login', intro: 'Para enviar la propuesta por enlace necesitas una cuenta gratuita: así podremos avisarte cuando tu cliente la acepte.' })
      return
    }
    if (!checkReady()) return
    setShareError(null)
    setDialog({ kind: 'share' })
    // Si aún no hay enlace, se crea al momento. Si lo hay y cambió, la ventana ofrece actualizarlo.
    if (!currentShare) publishShare()
  }

  const openDashboard = () => {
    setDialog({ kind: 'dashboard' })
    if (entitlements.dashboard) refreshShares({ force: true })
  }
  const pendingCount = account && entitlements.dashboard ? shares.filter((sh) => needsFollowUp(sh)).length : 0

  const handleSetShareActive = async (active) => {
    setShareBusy(true)
    setShareError(null)
    try {
      const share = await cloud.setShareActive(proposal.id, active)
      setShareState({ proposalId: proposal.id, share })
      refreshShares({ force: true })
    } catch (err) {
      setShareError(err?.userMessage ?? 'No se pudo cambiar el enlace.')
    } finally {
      setShareBusy(false)
    }
  }

  // ─── Cuenta: abrir, borrar, salir ─────────────────────────────────────────
  const handleOpenProposal = async (id) => {
    try {
      await flushCloudSave().catch(() => {})
      const loaded = await cloud.fetchProposal(id)
      resetWith(loaded, 'Propuesta abierta.', { alreadySaved: true })
    } catch (err) {
      setToast({ type: 'error', message: err.userMessage ?? 'No se pudo abrir la propuesta.' })
    }
  }

  const handleDeleteProposal = async (id) => {
    await cloud.deleteProposal(id)
    if (id === proposalRef.current.id) {
      setProposal(createEmptyProposal({ professional: proposalRef.current.professional, design: proposalRef.current.design }))
      lastSavedRef.current = null
      setCloudSave('idle')
    }
    setShares((list) => list.filter((sh) => sh.proposalId !== id))
    setToast({ type: 'success', message: 'Propuesta eliminada.' })
  }

  const leaveAccount = (message) => {
    clearDraft() // la copia de este navegador pertenecía a la cuenta
    setAccount(null)
    hadAccountAtStart.current = false
    resetWith(createEmptyProposal(loadProfile() ?? {}), message)
  }

  const handleSignOut = async () => {
    await flushCloudSave().catch(() => {})
    await cloud.signOut()
    leaveAccount('Sesión cerrada. Se ha borrado la copia de este navegador.')
  }

  const handleAccountDeleted = () => leaveAccount('Tu cuenta y todos sus datos se han eliminado.')

  // ─── Textos de estado ─────────────────────────────────────────────────────
  const saveMessage = account
    ? {
        idle: ' Se guardará en tu cuenta en cuanto escribas algo.',
        pending: ' Cambios sin guardar…',
        saving: ' Guardando en tu cuenta…',
        saved: ' Guardado en tu cuenta.',
        error: ' No se pudo guardar en tu cuenta.',
      }[cloudSave]
    : draftSaved
      ? ' El borrador se guarda automáticamente en este navegador.'
      : ' No se pudo guardar el borrador en este navegador (puede estar en modo privado).'

  return (
    <div className="app">
      <a className="skip-link" href="#editor">
        Saltar al formulario
      </a>

      <AppHeader
        usage={usage}
        cloudEnabled={cloud.cloudEnabled}
        account={account}
        onNew={handleNew}
        onDuplicate={handleDuplicate}
        onSample={handleSample}
        onExport={handleExport}
        onLogin={() => setDialog({ kind: 'login' })}
        onOpenProposals={() => setDialog({ kind: 'proposals' })}
        onOpenAccount={() => setDialog({ kind: 'account' })}
        onOpenDashboard={openDashboard}
        onOpenPlans={PAYMENTS.enabled ? openPlans : null}
        plan={plan}
        exporting={exporting}
      />

      <div className="tabs" role="tablist" aria-label="Vista">
        <button
          type="button"
          role="tab"
          id="tab-edit"
          aria-selected={activeTab === 'edit'}
          aria-controls="editor"
          className={`tabs__tab ${activeTab === 'edit' ? 'tabs__tab--active' : ''}`}
          onClick={() => switchTab('edit')}
        >
          Editar
          {showAllErrors && errorCount > 0 && <span className="tabs__badge">{errorCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-preview"
          aria-selected={activeTab === 'preview'}
          aria-controls="preview"
          className={`tabs__tab ${activeTab === 'preview' ? 'tabs__tab--active' : ''}`}
          onClick={() => switchTab('preview')}
        >
          Vista previa
        </button>
      </div>

      <main className={`workspace workspace--${activeTab}`}>
        <div className="workspace__editor" id="editor" aria-labelledby="tab-edit">
          <div className="editor-intro">
            <h1>Crea tu propuesta</h1>
            <p>
              Rellena los datos y revisa el resultado en la vista previa. Los campos con * son obligatorios.
              <span className={`editor-intro__save ${cloudSave === 'error' && account ? 'editor-intro__save--error' : ''}`} aria-live="polite">
                {saveMessage}
              </span>
              {account && cloudSave === 'error' && (
                <>
                  {' '}
                  <button type="button" className="link-button" onClick={() => flushCloudSave().catch(() => {})}>
                    Reintentar
                  </button>
                </>
              )}
            </p>
            {pendingCount > 0 && (
              <p className="follow-up-banner" role="status">
                {pendingCount === 1
                  ? 'Tienes 1 propuesta enviada sin respuesta desde hace días.'
                  : `Tienes ${pendingCount} propuestas enviadas sin respuesta desde hace días.`}{' '}
                <button type="button" className="link-button" onClick={openDashboard}>
                  Ver y recordar
                </button>
              </p>
            )}
          </div>
          <ProposalForm
            key={formKey}
            proposal={proposal}
            onFieldChange={handleFieldChange}
            onBlur={handleBlur}
            errorFor={errorFor}
            entitlements={entitlements}
            onLocked={openPlans}
          />
          <div className="editor-footer">
            <div className="editor-footer__buttons">
              <button type="button" className="button button--primary button--large" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Generando…' : 'Descargar PDF'}
              </button>
              {cloud.cloudEnabled && (
                <button type="button" className="button button--ghost button--large" onClick={handleShare} disabled={shareBusy}>
                  {currentShare ? 'Ver enlace enviado' : 'Enviar al cliente'}
                </button>
              )}
            </div>
            {currentShare && (
              <p className={`share-pill share-pill--${currentShare.status === 'accepted' ? 'accepted' : currentShare.revoked ? 'off' : 'sent'}`}>
                {shareStatusText(currentShare, entitlements.viewTracking)}
                {currentShare.status !== 'accepted' && isShareOutdated(currentShare, outputProposal) && ' · Tiene cambios sin enviar'}
              </p>
            )}
            <p className="editor-footer__note">
              {usage.loading
                ? 'Comprobando tu uso de este mes…'
                : usage.alreadyCounted
                  ? 'Esta propuesta ya se contó este mes: puedes volver a descargarla sin gastar otra.'
                  : `Te quedan ${usage.remaining} de ${usage.limit} propuestas este mes. Descargar o enviar la misma propuesta otra vez no cuenta de nuevo.`}
              {PAYMENTS.enabled && !isPaidPlan(plan) && (
                <>
                  {' '}
                  <button type="button" className="link-button" onClick={openPlans}>
                    Ver planes
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <aside className="workspace__preview" id="preview" aria-labelledby="tab-preview">
          <div className="preview-frame">
            <ProposalPreview model={model} />
          </div>
        </aside>
      </main>

      <footer className="app-footer">
        <p>
          proposio · Versión de prueba.{' '}
          {account ? 'Tus propuestas se guardan en tu cuenta.' : 'Tus datos se quedan en este navegador: no se envían a ningún servidor.'}
          {cloud.cloudEnabled && (
            <>
              {' '}
              <a href="privacidad.html" target="_blank" rel="noopener">
                Política de privacidad
              </a>
            </>
          )}
        </p>
      </footer>

      <Toast toast={toast} onClose={closeToast} />

      <Modal
        open={dialog?.kind === 'confirm'}
        title={dialog?.title}
        onClose={closeDialog}
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={closeDialog}>
              Cancelar
            </button>
            <button type="button" className="button button--primary" onClick={() => dialog?.onConfirm()}>
              {dialog?.confirmLabel}
            </button>
          </>
        }
      >
        <p>{dialog?.message}</p>
      </Modal>

      <Modal open={dialog?.kind === 'sample'} title="Empieza con un ejemplo" onClose={closeDialog} wide>
        <p className="modal__muted">
          Elige el más parecido a tu trabajo. Todos los datos son ficticios: cámbialos por los tuyos antes de enviar la propuesta.
        </p>
        <ul className="sample-list">
          {SAMPLE_PROFESSIONS.map((s) => (
            <li key={s.id}>
              <button type="button" className="sample-option" onClick={() => loadSample(s.id)}>
                <span className="sample-option__label">{s.label}</span>
                <span className="sample-option__example">{s.example}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={closeDialog}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        open={dialog?.kind === 'limit'}
        title="Has alcanzado el límite de este mes"
        onClose={closeDialog}
        actions={
          <>
            <button type="button" className={`button ${PAYMENTS.enabled ? 'button--ghost' : 'button--primary'}`} onClick={closeDialog}>
              Entendido
            </button>
            {PAYMENTS.enabled && plan !== 'business' && (
              <button type="button" className="button button--primary" onClick={openPlans}>
                Ver planes
              </button>
            )}
          </>
        }
      >
        <p>
          Tu plan {PLAN_LABELS[plan]} permite descargar {usage.limit} propuestas distintas al mes. El contador se reinicia el
          día 1 del mes que viene.
        </p>
        <p>
          Puedes seguir editando y volver a descargar cualquiera de las propuestas que ya descargaste este mes.
          {!PAYMENTS.enabled && ' Los planes de pago todavía no están disponibles.'}
        </p>
      </Modal>

      {cloud.cloudEnabled && (
        <>
          <LoginDialog open={dialog?.kind === 'login'} onClose={closeDialog} intro={dialog?.intro} />
          <ShareDialog
            open={dialog?.kind === 'share'}
            onClose={closeDialog}
            share={currentShare}
            proposal={outputProposal}
            busy={shareBusy}
            error={shareError}
            entitlements={entitlements}
            onUpdate={publishShare}
            onSetActive={handleSetShareActive}
            onOpenPlans={PAYMENTS.enabled ? openPlans : null}
          />
          <ProposalsDialog
            open={dialog?.kind === 'proposals'}
            onClose={closeDialog}
            currentId={proposal.id}
            onOpenProposal={handleOpenProposal}
            onDeleteProposal={handleDeleteProposal}
            locked={!entitlements.history}
            onOpenPlans={openPlans}
            shares={shares}
            viewTracking={entitlements.viewTracking}
          />
          <DashboardDialog
            open={dialog?.kind === 'dashboard'}
            onClose={closeDialog}
            shares={shares}
            loading={sharesLoading}
            locked={!entitlements.dashboard}
            onOpenPlans={openPlans}
            onOpenProposal={handleOpenProposal}
          />
          <AccountDialog
            open={dialog?.kind === 'account'}
            onClose={closeDialog}
            account={account}
            onSignOut={handleSignOut}
            onAccountDeleted={handleAccountDeleted}
            plan={plan}
            subscription={cloudUsage?.subscription ?? null}
            onOpenPlans={PAYMENTS.enabled ? openPlans : null}
          />
          {PAYMENTS.enabled && (
            <PlansDialog
              open={dialog?.kind === 'plans'}
              onClose={closeDialog}
              account={account}
              plan={plan}
              subscription={cloudUsage?.subscription ?? null}
              onLogin={() => setDialog({ kind: 'login' })}
            />
          )}
        </>
      )}
    </div>
  )
}
