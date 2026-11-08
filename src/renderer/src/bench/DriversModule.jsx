import { useEffect, useState } from 'react'
import {
  ArrowDownloadRegular,
  ArrowSyncRegular,
  BuildingFactoryRegular,
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
import { supportSiteFor } from '@/lib/support-links'

// Kept while the app runs, so leaving the page doesn't throw the comparison away
let lastScan = null

function describeDriver(driver) {
  if (!driver?.version) return 'none'
  return driver.date ? `${driver.version} (${driver.date})` : driver.version
}

// "10.0.1.01" and "10.0.1.1" are the same version
const sameVersion = (a, b) =>
  String(a).split('.').map(Number).join('.') === String(b).split('.').map(Number).join('.')

// The Microsoft Update Catalog finds drivers by the vendor and device part of the ID
const catalogSearchUrl = (hardwareId) =>
  `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(
    hardwareId.replace(/&(SUBSYS|REV|CC)_.*$/i, '')
  )}`

// What the candidate offers, for the row: its version, else its date
function describeOffer(candidate) {
  if (candidate.version) return describeDriver(candidate)
  return candidate.date ? `dated ${candidate.date}` : 'newer driver'
}

// Turns one install's result into the message shown under a device
function installOutcome(result, row) {
  if (!result?.success) {
    return {
      severity: 'error',
      text: result?.message ?? 'The driver wasn’t installed.',
      done: false
    }
  }
  const restart = result.rebootRequired ? ' Restart the device to finish.' : ''
  const from = ` from ${row.candidate.sourceName}`
  const newVersion = result.newVersions?.[row.deviceId] ?? null
  if (newVersion && (!row.candidate.version || sameVersion(newVersion, row.candidate.version))) {
    return {
      severity: 'success',
      text: `Installed version ${newVersion}${from}.${restart}`,
      done: true
    }
  }
  if (result.notApplied || newVersion) {
    return {
      severity: 'warning',
      text: `The driver was added, but Windows kept ${
        newVersion ? `version ${newVersion}` : 'the current driver'
      } because it ranks it higher (e.g. a better hardware match or a signed OEM driver).${restart}`,
      done: false
    }
  }
  return { severity: 'success', text: `Driver installed${from}.${restart}`, done: true }
}

// A link to the maker's driver and BIOS downloads, opened in the browser
function SupportSiteLink({ site, children }) {
  return (
    <a href={site.url} target="_blank" rel="noreferrer" className="text-accent-text underline">
      {children ?? `${site.name}’s support site`}
    </a>
  )
}

function BiosCard({ bios, disabled, onUpdate, outcome }) {
  const { system, candidate, status } = bios
  if (!system) return null
  const site = supportSiteFor(system.manufacturer)
  const installed = system.date ? `${system.version} (${system.date})` : system.version
  const detail = candidate
    ? `${candidate.sourceName}: ${candidate.version}${candidate.date ? ` (${candidate.date})` : ''} · ${candidate.label}`
    : (bios.notes?.[0] ?? 'No source offers BIOS updates for this model.')
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
        {status === 'outdated' && (candidate?.notes || candidate?.infoUrl) && (
          <p className="text-caption text-text-secondary">
            {candidate.notes}
            {candidate.infoUrl && (
              <>
                {candidate.notes && ' '}
                <a
                  href={candidate.infoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text underline"
                >
                  What’s in this update
                </a>
              </>
            )}
          </p>
        )}
        {site && status !== 'outdated' && (
          <p className="text-caption text-text-secondary">
            {status === 'none'
              ? 'Look for this model’s BIOS on '
              : 'Drivers and BIOS for this model are also on '}
            <SupportSiteLink site={site} />.
          </p>
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
            Installed {describeDriver(row.installed)} → {row.candidate.sourceName}{' '}
            {describeOffer(row.candidate)}
          </p>
          <p
            className="selectable truncate text-caption text-text-tertiary"
            title={row.candidate.label}
          >
            {row.candidate.label}
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
  const useMakers = settings.driversMakers
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
      const result = await window.api.scanDrivers({
        local,
        windowsUpdate: useWindowsUpdate,
        makers: useMakers
      })
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

  // Installs the drivers of the given rows in one request; every device a
  // driver covers gets its outcome (one driver can serve several devices)
  const install = async (chosen) => {
    const keys = new Set(chosen.map((r) => r.candidate.key))
    const covered = scan.rows.filter((r) => keys.has(r.candidate.key))
    const deviceIds = {}
    for (const r of covered) (deviceIds[r.candidate.key] ??= []).push(r.deviceId)
    setInstalling(keys)
    let results
    try {
      ;({ results } = await window.api.installDrivers(
        [...keys].map((key) => ({ key, deviceIds: deviceIds[key] ?? [] }))
      ))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results = Object.fromEntries([...keys].map((key) => [key, { success: false, message }]))
    }
    recordOutcomes(covered.map((r) => [r.deviceId, installOutcome(results[r.candidate.key], r)]))
    setInstalling(null)
  }

  const rows = scan?.rows ?? []
  const outdated = rows.filter((r) => r.status === 'outdated')
  const missing = rows.filter((r) => r.status === 'missing')
  const current = rows.filter((r) => r.status === 'current')
  const unavailable = scan?.unavailable ?? []
  const supportSite = supportSiteFor(scan?.bios?.system?.manufacturer)
  const pendingUpdates = outdated.filter((r) => !outcomes[r.deviceId]?.done)

  const updateAll = () => install(pendingUpdates)

  const startBiosUpdate = async () => {
    setStartingBios(true)
    try {
      setBiosOutcome(await window.api.updateBios(scan.bios.candidate.key))
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
        busy={installing?.has(row.candidate.key) ?? false}
        disabled={busy}
        actionLabel={actionLabel}
        onInstall={() => void install([row])}
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
        <SettingsCard
          icon={BuildingFactoryRegular}
          title="Manufacturer catalogs"
          description="BIOS and drivers from the maker's own catalog, for Dell, HP and Lenovo computers. Downloaded from the maker and checked against its signature. Needs internet."
        >
          <ToggleSwitch
            label="Manufacturer catalogs"
            checked={useMakers}
            disabled={busy}
            onChange={(on) => void updateSetting('driversMakers', on)}
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
          disabled={!(useWindowsUpdate || useMakers || local) || busy}
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
              useMakers && 'checking the maker’s catalog',
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
        {!scanning &&
          scan?.sources
            ?.filter((source) => !source.ok)
            .map((source) => (
              <InfoBar
                key={source.id}
                severity="warning"
                title={`${source.name.replace(/^./, (c) => c.toUpperCase())} couldn't be searched.`}
              >
                {source.error}
              </InfoBar>
            ))}
        {scan?.supported && !scan.error && !scanning && (
          <p className="text-caption text-text-secondary">
            {[
              ...(scan.sources ?? []).filter((source) => source.ok).map((source) => source.summary),
              `${rows.length} of ${scan.deviceCount} devices have a matching driver`
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {scan?.supported && !scan.error && scan.devicesRead && rows.length === 0 && !scanning && (
        <InfoBar severity="info" className="mt-3">
          {scan.sources?.some((source) => source.id === 'windowsUpdate' && source.ok)
            ? 'Every driver is up to date: no source offers anything newer.'
            : "None of the drivers match this device's hardware."}
        </InfoBar>
      )}

      {scan?.bios && !scanning && (
        <BiosCard
          bios={scan.bios}
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
          description={`Devices without a driver that no source offers one for. Search the Microsoft Update Catalog by hardware ID, or ${supportSite ? `${supportSite.name}’s support site` : "the maker's support site"}.`}
          className="mt-6"
        >
          {supportSite && (
            <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <BuildingFactoryRegular aria-hidden className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>{supportSite.name} support</p>
                <p className="text-caption text-text-secondary">
                  Drivers and BIOS for{' '}
                  {scan.bios.system.displayModel ?? scan.bios.system.model ?? 'this model'}, from
                  the maker.
                </p>
              </div>
              <Button icon={OpenRegular} onClick={() => window.open(supportSite.url, '_blank')}>
                Open support site
              </Button>
            </Card>
          )}
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
          {scan?.bios?.candidate?.source === 'folder'
            ? 'WinDiag starts '
            : `WinDiag downloads from ${scan?.bios?.candidate?.sourceName}, checks its signature and starts `}
          {scan?.bios?.candidate?.label ?? 'the updater'} (version {scan?.bios?.candidate?.version}
          ). Before you continue:
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
