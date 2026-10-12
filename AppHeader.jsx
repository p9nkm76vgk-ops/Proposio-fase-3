// Cabecera: marca, contador mensual y acciones principales.

import { BrandMark } from './BrandMark.jsx'
import { CopyIcon, DownloadIcon, FileIcon, FolderIcon, LoginIcon, SparkIcon, Spinner, UserIcon } from './Icons.jsx'

export function UsageMeter({ usage, account }) {
  const percent = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  const full = usage.limit > 0 && usage.used >= usage.limit
  return (
    <div className="usage" title={account ? 'Uso de tu cuenta este mes' : 'Contador provisional guardado solo en este navegador'}>
      <div className="usage__text">
        <span className="usage__plan">Plan gratuito</span>
        {usage.loading ? (
          <span>Comprobando…</span>
        ) : (
          <span>
            <strong>{usage.used}</strong> de {usage.limit} propuestas este mes
          </span>
        )}
      </div>
      <div
        className={`usage__bar ${full ? 'usage__bar--full' : ''}`}
        role="progressbar"
        aria-label="Propuestas descargadas este mes"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/** Botón secundario: en pantallas pequeñas muestra solo el icono (con nombre accesible). */
function HeaderButton({ icon, label, onClick }) {
  return (
    <button type="button" className="button button--ghost header-button" onClick={onClick} aria-label={label} title={label}>
      {icon}
      <span className="header-button__label" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}

export function AppHeader({
  usage,
  cloudEnabled,
  account,
  onNew,
  onDuplicate,
  onSample,
  onExport,
  onLogin,
  onOpenProposals,
  onOpenAccount,
  exporting,
}) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="brand">
          <BrandMark size={34} />
          <span className="brand__name">proposio</span>
        </div>

        <UsageMeter usage={usage} account={account} />

        <div className="app-header__actions">
          <HeaderButton icon={<SparkIcon />} label="Ejemplo" onClick={onSample} />
          <HeaderButton icon={<CopyIcon />} label="Duplicar" onClick={onDuplicate} />
          <HeaderButton icon={<FileIcon />} label="Nueva" onClick={onNew} />
          {cloudEnabled && account && <HeaderButton icon={<FolderIcon />} label="Mis propuestas" onClick={onOpenProposals} />}
          {cloudEnabled && account && <HeaderButton icon={<UserIcon />} label="Mi cuenta" onClick={onOpenAccount} />}
          {cloudEnabled && !account && <HeaderButton icon={<LoginIcon />} label="Entrar" onClick={onLogin} />}
          <button
            type="button"
            className="button button--primary"
            onClick={onExport}
            disabled={exporting}
            aria-busy={exporting ? 'true' : undefined}
          >
            {exporting ? <Spinner /> : <DownloadIcon />}
            <span>
              {exporting ? 'Generando…' : (
                <>
                  <span className="hide-sm">Descargar </span>PDF
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
