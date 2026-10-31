import { useEffect, useState } from 'react'
import {
  ArrowDownloadRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  CloudArrowDownRegular,
  DeveloperBoardRegular,
  DocumentAddRegular,
  DocumentBulletListRegular,
  FolderOpenRegular,
  OpenRegular,
  QuestionCircleRegular,
  SettingsRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card, Expander, Section, SettingsCard } from '@/components/ui/Card'
import { Badge, ContentDialog, InfoBar, ProgressRing, ToggleSwitch } from '@/components/ui/feedback'
import { useSettings } from '@/context/SettingsContext'

// Kept while the app runs, so leaving the page doesn't throw the comparison away
let lastScan = null

function describeDriver(driver) {
  if (!driver?.version) return 'none'
  return driver.date ? `${driver.version} (${driver.date})` : driver.version
}

// "10.0.1.01" and "10.0.1.1" are the same version
const sameVersion = (a, b) =>
  String(a).split('.').map(Number).join('.') === String(b).split('.').map(Number).join('.')

// What identifies one install: an INF from the folder or a Windows Update update
const candidateKey = (candidate) =>
  candidate.source === 'windowsUpdate' ? `wu:${candidate.updateId}` : candidate.infPath

const SOURCE_NAMES = { folder: 'folder', windowsUpdate: 'Windows Update' }

// The Microsoft Update Catalog finds drivers by the vendor and device part of the ID
const catalogSearchUrl = (hardwareId) =>
  `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(
    hardwareId.replace(/&(SUBSYS|REV|CC)_.*$/i, '')
  )}`

// Windows Update's outcome for one device, in the same shape as installOutcome
function windowsUpdateOutcome(result, row) {
  const own = result.results?.[row.candidate.updateId]
  if (!own) return { severity: 'error', text: result.message, done: false }
  if (!own.success) return { severity: 'error', text: result.message, done: false }
  const restart = result.rebootRequired ? ' Restart the device to finish.' : ''
  const version = own.newVersions?.[row.deviceId]
  return {
    severity: 'success',
    text: version
      ? `Installed version ${version} from Windows Update.${restart}`
      : `Installed from Windows Update.${restart}`,
    done: true
  }
}

// Turns pnputil's outcome into the message shown under the device
function installOutcome(result, candidate) {
  if (!result.success) return { severity: 'error', text: result.message, done: false }
  const restart = result.rebootRequired ? ' Restart the device to finish.' : ''
  if (result.newVersion && sameVersion(result.newVersion, candidate.version)) {
    return {
      severity: 'success',
      text: `Installed version ${result.newVersion}.${restart}`,
      done: true
    }
  }
  if (result.notApplied || result.newVersion) {
    return {
      severity: 'warning',
      text: `The driver was added, but Windows kept ${
        result.newVersion ? `version ${result.newVersion}` : 'the current driver'
      } because it ranks it higher (e.g. a better hardware match or a signed OEM driver).${restart}`,
      done: false
    }
  }
  return { severity: 'success', text: `Driver installed.${restart}`, done: true }
}

function BiosCard({ bios, local, disabled, onUpdate, outcome }) {
  const { system, candidate, status } = bios
  if (!system) return null
  const installed = system.date ? `${system.version} (${system.date})` : system.version
  let detail
  if (status === 'outdated' || status === 'current') {
    detail = `Catalog: ${candidate.version}${candidate.date ? ` (${candidate.date})` : ''} · ${candidate.relPath}`
  } else if (!bios.catalogHasBios) {
    detail =
      local?.kind === 'catalog'
        ? 'The catalog lists no BIOS updates.'
        : 'BIOS updates are only compared with a driver catalog (add them to its "bios" list).'
  } else {
    detail = 'The catalog has no BIOS update for this model.'
  }
  return (
    <Section title="BIOS" className="mt-6">
      <Card className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DeveloperBoardRegular aria-hidden className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="selectable truncate">
              {[system.manufacturer, system.displayModel ?? system.model].filter(Boolean).join(' ')}
              {system.displayModel && system.displayModel !== system.model && (
                <span className="text-text-secondary"> ({system.model})</span>
              )}
            </p>
            <p className="text-caption text-text-secondary">Installed {installed || 'unknown'}</p>
            <p className="selectable truncate text-caption text-text-tertiary" title={detail}>
              {detail}
            </p>
          </div>
          {status === 'current' && <Badge tone="success">Up to date</Badge>}
          {status === 'outdated' && !outcome?.success && (
            <>
              <Badge tone="caution">Update available</Badge>
              <Button icon={ArrowDownloadRegular} disabled={disabled} onClick={onUpdate}>
                Update BIOS…
              </Button>
            </>
          )}
        </div>
        {candidate?.notes && status === 'outdated' && (
          <p className="text-caption text-text-secondary">{candidate.notes}</p>
        )}
        {outcome && (
          <InfoBar severity={outcome.success ? 'success' : 'error'}>
            {outcome.success
              ? `The BIOS updater is running: follow its window. The device restarts to finish.${
                  outcome.bitlockerSuspended
                    ? ' BitLocker is suspended until the next restart.'
                    : ''
                }`
              : outcome.message}
          </InfoBar>
        )}
      </Card>
    </Section>
  )
}

function DriverRow({ row, outcome, busy, disabled, actionLabel, onInstall }) {
  return (
    <Card className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="selectable truncate">{row.name}</p>
          <p className="text-caption text-text-secondary">
            Installed {describeDriver(row.installed)} → {SOURCE_NAMES[row.candidate.source]}{' '}
            {row.candidate.version
              ? describeDriver(row.candidate)
              : row.candidate.date
                ? `dated ${row.candidate.date}`
                : 'newer driver'}
          </p>
          <p
            className="selectable truncate text-caption text-text-tertiary"
            title={row.candidate.relPath ?? row.candidate.title}
          >
            {row.candidate.relPath ?? row.candidate.title}
          </p>
        </div>
        {outcome?.done ? (
          <Badge tone="success">Done</Badge>
        ) : (
          <Button
            icon={busy ? undefined : ArrowDownloadRegular}
            disabled={disabled}
            onClick={onInstall}
          >
            {busy ? <ProgressRing size={16} label="Installing" /> : actionLabel}
          </Button>
        )}
      </div>
      {outcome && !outcome.done && <InfoBar severity={outcome.severity}>{outcome.text}</InfoBar>}
      {outcome?.done && <p className="text-caption text-success">{outcome.text}</p>}
    </Card>
  )
}

export function DriversModule({ onNavigate }) {
  const { settings, updateSetting } = useSettings()
  const [folder, setFolder] = useState(settings.driversFolder)
  const [scan, setScan] = useState(lastScan)
  const [scanning, setScanning] = useState(false)
  // deviceId → outcome of the last install on it
  const [outcomes, setOutcomes] = useState({})
  // Candidate keys being installed right now (pnputil and Windows Update
  // each serialize anyway, so the page runs one install at a time)
  const [installing, setInstalling] = useState(null)
  const [creatingCatalog, setCreatingCatalog] = useState(false)
  const [catalogResult, setCatalogResult] = useState(null)
  const [confirmBios, setConfirmBios] = useState(false)
  const [startingBios, setStartingBios] = useState(false)
  const [biosOutcome, setBiosOutcome] = useState(null)
  const catalog = settings.driverCatalog
  const useWindowsUpdate = settings.driversWindowsUpdate
  const useFolder = settings.driversUseFolder
  const local = !useFolder
    ? null
    : catalog
      ? { kind: 'catalog', path: catalog }
      : folder
        ? { kind: 'folder', path: folder }
        : null

  useEffect(() => {
    if (folder) return
    void window.api.findDefaultDriverFolder().then((found) => {
      if (found) setFolder(found)
    })
  }, [folder])

  const chooseFolder = async () => {
    const chosen = await window.api.chooseDriverFolder(folder || undefined)
    if (!chosen) return
    setFolder(chosen)
    void updateSetting('driversFolder', chosen)
  }

  const compare = async () => {
    setScanning(true)
    setOutcomes({})
    setBiosOutcome(null)
    try {
      const result = await window.api.scanDrivers({ local, windowsUpdate: useWindowsUpdate })
      lastScan = result
      setScan(result)
    } catch (err) {
      setScan({ supported: true, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setScanning(false)
    }
    if (useFolder && !catalog && folder && folder !== settings.driversFolder) {
      void updateSetting('driversFolder', folder)
    }
  }

  const createCatalog = async () => {
    setCreatingCatalog(true)
    setCatalogResult(null)
    try {
      const result = await window.api.createDriverCatalog(folder)
      if (!result.canceled) setCatalogResult(result)
    } catch (err) {
      setCatalogResult({
        success: false,
        message: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setCreatingCatalog(false)
    }
  }

  const recordOutcomes = (entries) =>
    setOutcomes((prev) => ({ ...prev, ...Object.fromEntries(entries) }))

  // Installs one INF; every device it covers gets the outcome
  const installFromFolder = async (row) => {
    const { infPath } = row.candidate
    setInstalling(new Set([infPath]))
    let outcome
    try {
      outcome = installOutcome(await window.api.installDriver(infPath, row.deviceId), row.candidate)
    } catch (err) {
      outcome = { severity: 'error', text: err instanceof Error ? err.message : String(err) }
    }
    const covered = scan.rows.filter((r) => r.candidate.infPath === infPath)
    recordOutcomes(covered.map((r) => [r.deviceId, outcome]))
    setInstalling(null)
    return outcome
  }

  // Installs Windows Update drivers in one download and install; every
  // device each one covers gets its outcome
  const installFromWindowsUpdate = async (chosen) => {
    const updateIds = new Set(chosen.map((r) => r.candidate.updateId))
    const covered = scan.rows.filter(
      (r) => r.candidate.source === 'windowsUpdate' && updateIds.has(r.candidate.updateId)
    )
    const devices = {}
    for (const r of covered) (devices[r.candidate.updateId] ??= []).push(r.deviceId)
    setInstalling(new Set([...updateIds].map((id) => `wu:${id}`)))
    let result
    try {
      result = await window.api.installWindowsUpdateDrivers(devices)
    } catch (err) {
      result = {
        success: false,
        message: err instanceof Error ? err.message : String(err),
        results: {}
      }
    }
    const entries = covered.map((r) => [r.deviceId, windowsUpdateOutcome(result, r)])
    recordOutcomes(entries)
    setInstalling(null)
    return entries[0]?.[1] ?? { severity: 'error', text: result.message }
  }

  const install = (row) =>
    row.candidate.source === 'windowsUpdate'
      ? installFromWindowsUpdate([row])
      : installFromFolder(row)

  const rows = scan?.rows ?? []
  const outdated = rows.filter((r) => r.status === 'outdated')
  const missing = rows.filter((r) => r.status === 'missing')
  const current = rows.filter((r) => r.status === 'current')
  const unavailable = scan?.unavailable ?? []
  const pendingUpdates = outdated.filter((r) => !outcomes[r.deviceId]?.done)

  const updateAll = async () => {
    const fromWindowsUpdate = pendingUpdates.filter((r) => r.candidate.source === 'windowsUpdate')
    const seen = new Set()
    for (const row of pendingUpdates) {
      if (row.candidate.source === 'windowsUpdate' || seen.has(row.candidate.infPath)) continue
      seen.add(row.candidate.infPath)
      const outcome = await installFromFolder(row)
      // Missing permission fails every install the same way
      if (outcome.severity === 'error' && /Administrator/.test(outcome.text)) return
    }
    if (fromWindowsUpdate.length > 0) await installFromWindowsUpdate(fromWindowsUpdate)
  }

  const startBiosUpdate = async () => {
    setStartingBios(true)
    try {
      setBiosOutcome(await window.api.updateBios(scan.bios.candidate.path))
    } catch (err) {
      setBiosOutcome({ success: false, message: err instanceof Error ? err.message : String(err) })
    } finally {
      setStartingBios(false)
      setConfirmBios(false)
    }
  }

  const busy = scanning || creatingCatalog || startingBios || installing !== null
  const renderRows = (list, actionLabel) =>
    list.map((row) => (
      <DriverRow
        key={row.deviceId}
        row={row}
        outcome={outcomes[row.deviceId]}
        busy={installing?.has(candidateKey(row.candidate)) ?? false}
        disabled={busy}
        actionLabel={actionLabel}
        onInstall={() => void install(row)}
      />
    ))

  return (
    <Page
      title="Drivers"
      description="Compare this device's drivers with Windows Update and your own driver folder, and install the newer ones."
    >
      <Section title="Compare with">
        <SettingsCard
          icon={CloudArrowDownRegular}
          title="Windows Update"
          description="Drivers from Microsoft for any brand of laptop or desktop. Needs internet; the search takes a minute or two."
        >
          <ToggleSwitch
            label="Windows Update"
            checked={useWindowsUpdate}
            disabled={busy}
            onChange={(on) => void updateSetting('driversWindowsUpdate', on)}
          />
        </SettingsCard>
        {useFolder && catalog && (
          <SettingsCard
            icon={DocumentBulletListRegular}
            title={catalog}
            description="Driver catalog. Change or remove it in Settings."
          >
            <Button icon={SettingsRegular} onClick={() => onNavigate('settings')}>
              Settings
            </Button>
          </SettingsCard>
        )}
        <SettingsCard
          icon={FolderOpenRegular}
          title={folder || 'No driver folder chosen'}
          description={
            !useFolder
              ? 'Your own driver folder or server share. Off: only Windows Update is compared.'
              : catalog
                ? 'Driver folder, used to create a new catalog. The comparison uses the catalog above.'
                : 'WinDiag looks for a "02 Drivers" folder on every drive. Only .inf drivers can be compared; .exe and .zip installers and "- OLD" folders are skipped.'
          }
        >
          <ToggleSwitch
            label="Driver folder"
            checked={useFolder}
            disabled={busy}
            onChange={(on) => void updateSetting('driversUseFolder', on)}
          />
          <Button disabled={busy} onClick={() => void chooseFolder()}>
            Browse…
          </Button>
          <Button
            icon={creatingCatalog ? undefined : DocumentAddRegular}
            disabled={!folder || busy}
            title="Save a .json list of this folder's drivers"
            onClick={() => void createCatalog()}
          >
            {creatingCatalog ? (
              <>
                <ProgressRing size={16} label="Creating catalog" /> Creating…
              </>
            ) : (
              'Create catalog…'
            )}
          </Button>
        </SettingsCard>
      </Section>
      <div className="mt-3 flex flex-wrap justify-end">
        <Button
          variant="accent"
          icon={scanning ? undefined : ArrowSyncRegular}
          disabled={!(useWindowsUpdate || local) || busy}
          onClick={() => void compare()}
        >
          {scanning ? 'Comparing…' : 'Compare drivers'}
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {catalogResult && (
          <InfoBar
            severity={catalogResult.success ? 'success' : 'error'}
            onDismiss={() => setCatalogResult(null)}
            action={
              catalogResult.success &&
              catalogResult.path !== catalog && (
                <Button onClick={() => void updateSetting('driverCatalog', catalogResult.path)}>
                  Use this catalog
                </Button>
              )
            }
          >
            {catalogResult.success
              ? `Saved ${catalogResult.count} drivers and ${catalogResult.biosCount} BIOS updaters to ${catalogResult.path}.${
                  catalogResult.biosCount > 0
                    ? ' Open it and check the model and version of each BIOS entry.'
                    : ''
                }`
              : catalogResult.message}
          </InfoBar>
        )}
        {scanning && (
          <Card className="flex items-center gap-3 px-4 py-4 text-text-secondary">
            <ProgressRing size={16} label="Comparing" />
            {[
              useWindowsUpdate && 'Searching Windows Update',
              local?.kind === 'catalog' && 'reading the catalog',
              local?.kind === 'folder' && 'reading the folder',
              'reading the installed drivers'
            ]
              .filter(Boolean)
              .join(', ')
              .replace(/^./, (c) => c.toUpperCase())}
            … This can take a minute or two.
          </Card>
        )}
        {scan && !scanning && scan.supported === false && (
          <InfoBar severity="info">Driver comparison only works on Windows.</InfoBar>
        )}
        {scan?.error && !scanning && <InfoBar severity="error">{scan.error}</InfoBar>}
        {scan?.supported && !scan.error && !scanning && !scan.devicesRead && (
          <InfoBar severity="warning" title="Couldn't read the installed drivers.">
            Try again, or run WinDiag as administrator.
          </InfoBar>
        )}
        {scan?.windowsUpdate && !scan.windowsUpdate.ok && !scanning && (
          <InfoBar severity="warning" title="Windows Update couldn't be searched.">
            {scan.windowsUpdate.error}
          </InfoBar>
        )}
        {scan?.supported && !scan.error && !scanning && (
          <p className="text-caption text-text-secondary">
            {[
              scan.windowsUpdate?.ok && `Windows Update offers ${scan.windowsUpdate.count} drivers`,
              scan.local?.kind === 'catalog' &&
                `${scan.usableInfCount} of ${scan.infCount} catalog entries are usable`,
              scan.local?.kind === 'folder' &&
                `${scan.usableInfCount} of ${scan.infCount} INF files apply to this system`,
              `${rows.length} of ${scan.deviceCount} devices have a matching driver`
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {scan?.supported && !scan.error && scan.devicesRead && rows.length === 0 && !scanning && (
        <InfoBar severity="info" className="mt-3">
          {scan.windowsUpdate?.ok
            ? 'Every driver is up to date: Windows Update offers nothing newer.'
            : "None of the drivers match this device's hardware."}
        </InfoBar>
      )}

      {scan?.bios && !scanning && (
        <BiosCard
          bios={scan.bios}
          local={scan.local}
          disabled={busy}
          outcome={biosOutcome}
          onUpdate={() => setConfirmBios(true)}
        />
      )}

      {outdated.length > 0 && (
        <Section
          title={`Updates available (${outdated.length})`}
          className="mt-6"
          actions={
            pendingUpdates.length > 1 && (
              <Button
                variant="accent"
                icon={ArrowDownloadRegular}
                disabled={busy}
                onClick={() => void updateAll()}
              >
                Update all
              </Button>
            )
          }
        >
          {renderRows(outdated, 'Update')}
        </Section>
      )}

      {missing.length > 0 && (
        <Section
          title={`Missing drivers (${missing.length})`}
          description="Devices with no driver, or one that failed to install."
          className="mt-6"
        >
          {renderRows(missing, 'Install')}
        </Section>
      )}

      {unavailable.length > 0 && (
        <Section
          title={`No driver found (${unavailable.length})`}
          description="Devices without a driver that no source offers one for. Search the Microsoft Update Catalog by hardware ID, or the maker's support site."
          className="mt-6"
        >
          {unavailable.map((device) => (
            <Card
              key={device.deviceId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <QuestionCircleRegular aria-hidden className="size-5 shrink-0 text-text-secondary" />
              <div className="min-w-0 flex-1">
                <p className="selectable truncate">{device.name}</p>
                <p className="selectable truncate text-caption text-text-tertiary">
                  {device.hardwareId ?? device.deviceId}
                </p>
              </div>
              {device.hardwareId && (
                <Button
                  icon={OpenRegular}
                  onClick={() => window.open(catalogSearchUrl(device.hardwareId), '_blank')}
                >
                  Search the catalog
                </Button>
              )}
            </Card>
          ))}
        </Section>
      )}

      {current.length > 0 && (
        <Section className="mt-6">
          <Expander
            icon={CheckmarkCircleRegular}
            title={`Up to date (${current.length})`}
            description="The installed driver is the same as or newer than the one on offer."
          >
            <ul className="flex flex-col gap-2">
              {current.map((row) => (
                <li key={row.deviceId} className="flex flex-wrap justify-between gap-x-4">
                  <span className="selectable min-w-0 truncate">{row.name}</span>
                  <span className="text-caption text-text-secondary">
                    {describeDriver(row.installed)}
                  </span>
                </li>
              ))}
            </ul>
          </Expander>
        </Section>
      )}
      <ContentDialog
        open={confirmBios}
        title="Update the BIOS?"
        primaryText={startingBios ? 'Starting…' : 'Start update'}
        onPrimary={() => void startBiosUpdate()}
        closeText="Cancel"
        onClose={() => setConfirmBios(false)}
        busy={startingBios}
      >
        <p>
          WinDiag starts {scan?.bios?.candidate?.relPath ?? 'the updater'} (version{' '}
          {scan?.bios?.candidate?.version}). Before you continue:
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>Keep the AC adapter connected the whole time.</li>
          <li>Don’t turn off the device, close the lid or remove the battery.</li>
          <li>Save your work: the updater restarts the device.</li>
          <li>If BitLocker is on, WinDiag suspends it for one restart.</li>
        </ul>
      </ContentDialog>
    </Page>
  )
}
