// Where drivers and BIOS updates come from. The Drivers page compares the
// computer with every source that applies and offers the newest of each.
//
// A registry entry is plain data, so listing a source costs nothing: its code
// is only loaded (load()) when the request turns it on and, for a maker's
// source, when the computer is from that maker.
//
//   id            Stable name, also the prefix of every key the source makes
//   name          Shown on the page ("Windows Update", "folder")
//   isEnabled     (request) → whether the technician turned it on
//   manufacturer  Optional RegExp tested on Win32_ComputerSystem.Manufacturer
//   load          () → the source's module
//
// A source's module exports:
//
//   find(context) → {
//     drivers: [{ key, hardwareIds, version, date, provider, label, ... }],
//     bios:    [{ key, version, installedVersion?, date, label, notes, infoUrl?, ... }],
//     summary: one line for the page, or null,
//     biosNote: why there's no BIOS from this source, or null,
//     error:   what went wrong (the other sources still count),
//     fatal:   true when the whole comparison should stop with `error`
//   }
//   install(candidates) → { [key]: { success, message, rebootRequired, notApplied } }
//   prepareBios(candidate) → { file, args }: the updater to start
//
// `context` is { request, inventory }, where inventory is a promise of
// { system, devices } (the computer and its devices), read once for all.
// system is { manufacturer, model, sku, board, version (BIOS), date,
// osBuild, osRelease }. A BIOS's installedVersion is the computer's BIOS
// version in the same terms as `version`, when the maker writes them apart.
// Keys must be unique across sources; the rest of each candidate is the
// source's own data, handed back to install() and prepareBios() unchanged.

export const DRIVER_SOURCES = [
  {
    id: 'windowsUpdate',
    name: 'Windows Update',
    isEnabled: (request) => request.windowsUpdate === true,
    load: () => import('./windows-update')
  },
  {
    id: 'folder',
    name: 'folder',
    isEnabled: (request) => request.local != null,
    load: () => import('./local')
  },
  // Makers' catalogs: each one loads only on that maker's computers
  {
    id: 'dell',
    name: 'Dell',
    manufacturer: /^dell/i,
    isEnabled: (request) => request.makers === true,
    load: () => import('./dell')
  },
  {
    id: 'hp',
    name: 'HP',
    manufacturer: /^(hp|hewlett)/i,
    isEnabled: (request) => request.makers === true,
    load: () => import('./hp')
  },
  {
    id: 'lenovo',
    name: 'Lenovo',
    manufacturer: /^lenovo/i,
    isEnabled: (request) => request.makers === true,
    load: () => import('./lenovo')
  }
]

const byId = new Map(DRIVER_SOURCES.map((source) => [source.id, source]))

export function getSource(id) {
  return byId.get(id) ?? null
}

/** The sources that run for this request and computer, loaded. */
export async function activeSources(request, inventory) {
  const active = []
  for (const source of DRIVER_SOURCES) {
    if (!source.isEnabled(request)) continue
    if (source.manufacturer) {
      const { system } = await inventory
      if (!source.manufacturer.test(String(system?.manufacturer ?? ''))) continue
    }
    active.push({ ...source, module: await source.load() })
  }
  return active
}
