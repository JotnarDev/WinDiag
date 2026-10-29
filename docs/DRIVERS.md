# Setting up a driver folder or server

This guide explains how to organize drivers so the **Drivers** page can compare and install them, from a USB drive or from a network share. The short version of the same information is in the [README](../README.md#drivers-catalog-and-bios).

---

## 1. How WinDiag uses the folder

WinDiag never runs driver installers. It reads `.inf` files, compares them with the devices in the computer and installs the newer ones with:

```
pnputil /add-driver <file.inf> /install
```

Because of that:

- **Only `.inf` drivers are compared.** `.exe`, `.msi` and `.zip` files are skipped. Extract them first (see [section 6](#6-preparing-drivers-that-come-as-exe-or-zip)).
- **Each `.inf` needs its whole package next to it.** `pnputil` copies the files the `.inf` refers to (`.sys`, `.cat`, `.dll`, subfolders…) from the same folder. Never copy an `.inf` alone.
- **Folder names don't matter for drivers.** WinDiag matches by hardware ID, not by folder. The structure below is only to keep things tidy and to let WinDiag guess BIOS entries.

---

## 2. Recommended structure

```
02 Drivers\                          ← the driver folder (share this one)
│  drivers-catalog.json              ← catalog, at the root of the folder
│
├─ Panasonic\                        ← level 1: manufacturer
│  ├─ FZ-55\                         ← level 2: model
│  │  ├─ FZ-55 MK1\
│  │  │  ├─ Chipset\
│  │  │  │    SetupChipset.inf  *.cat  *.sys …
│  │  │  ├─ Video\
│  │  │  │    iigd_dch.inf  *.cat  *.sys …
│  │  │  └─ BIOS\                    ← "BIOS" in the folder name
│  │  │       BIOS_55_V100L31.exe
│  │  └─ FZ-55 MK2\
│  │     └─ …
│  └─ CF-33\
│     └─ …
├─ Getac\
│  └─ …
└─ Dell\
   └─ …
```

Rules WinDiag follows when it reads the folder:

| Rule | Detail |
|---|---|
| Depth | Subfolders are read up to 12 levels deep. |
| Retired folders | Folders whose name ends in `- OLD` (for example `Wi-Fi 22.40 - OLD`) are skipped, with everything inside them. Use it to keep old versions without WinDiag offering them. |
| Large files | `.inf` files over 4 MB are skipped (no real driver INF is that large). |
| Architecture | On 64-bit Windows only the `NTamd64` sections of an `.inf` count, so 32-bit and Windows XP drivers in the same folder are ignored. |
| Duplicates | If several `.inf` files match a device, the newest one wins (by version, then by date). Keeping two versions is harmless. |
| BIOS guessing | When creating a catalog, `.exe`, `.cmd` and `.bat` files inside a folder with "BIOS" in its name (or with "BIOS" in the file name) are added as BIOS entries. The manufacturer is taken from the level 1 folder and the model from the level 2 folder. See [section 5](#5-bios-updates). |

When the folder is on a USB drive, name it `02 Drivers` and put it at the root of the drive (`E:\02 Drivers`). WinDiag finds it by itself. On a server, the name doesn't matter.

---

## 3. Using a network share

Reading hundreds of `.inf` files over the network is slow, so **on a server, always use a catalog** (section 4). WinDiag then reads one small `.json` file to compare, and only goes to the server for the drivers it installs.

### 3.1 Share the folder

- Share the **driver folder itself** (`02 Drivers`) or a folder above it.
- **Read access is enough** for the computers being prepared. Only the person who creates the catalog needs write access to save `drivers-catalog.json`.

### 3.2 Use the full network path

In WinDiag, always use the UNC path:

```
\\SERVER\Drivers\02 Drivers\drivers-catalog.json
```

**Don't use a mapped drive letter** (`Z:\…`). WinDiag runs as administrator, and Windows doesn't show an administrator app the drives mapped by the normal user session, even if it is the same user.

### 3.3 Save the server credentials

Computers being prepared usually run on a local account (for example, Sysprep's Audit mode), not on a domain account, so the server will ask for credentials. WinDiag can't show that prompt. Save the credentials once per computer **before** opening WinDiag, from a Command Prompt:

```
cmdkey /add:SERVER /user:DOMAIN\username /pass
```

`cmdkey` asks for the password and stores it in Windows Credential Manager. Use the same server name as in the UNC path (`SERVER`, or its full name or IP if that's what the path uses). To remove it later:

```
cmdkey /delete:SERVER
```

You can also do it from *Control Panel → Credential Manager → Windows Credentials → Add a Windows credential*.

To check that it works, open `\\SERVER\Drivers` in File Explorer. If it opens without asking for a password, WinDiag can read it too.

---

## 4. The catalog (`drivers-catalog.json`)

### 4.1 Create it

1. On a computer that can **write** to the share, open WinDiag → **Drivers**.
2. Choose the driver folder with **Browse…**, using its UNC path.
3. Click **Create catalog…** and save the file **at the root of that same folder** (WinDiag suggests that location by default).
4. Open the `.json` and review the `bios` entries (section 5).

Saved at the root of the folder, the catalog has `"root": ""`, which means "paths start in the folder where this file is". That way the whole folder can be moved, copied to a USB drive or reached by any server name, and it keeps working.

> If the catalog is saved somewhere else, WinDiag writes the folder's full path into `root`. That path must then be valid on every computer that uses the catalog. A local path on the server (`D:\Drivers`) or a mapped letter (`Z:\`) won't work for the other computers. If you need it, use the UNC path in `root`.

### 4.2 Use it

On each computer: **Settings → Drivers → Driver catalog**, enter the UNC path to the `.json` (or pick it with **Browse…**). The Drivers page then shows it under *Compare with*.

### 4.3 Keep it up to date

The catalog is a snapshot: **it doesn't update itself.**

- **After adding drivers to the server**, run **Create catalog…** again and save over the same file. New drivers aren't offered until you do.
- **After deleting or moving drivers**, do the same. Otherwise WinDiag offers drivers that are no longer there, and installing them fails with "The driver file can't be reached".
- Saving over an existing catalog **keeps its `bios` entries** as they are (they are reviewed by hand) and only adds updaters it didn't list yet.

### 4.4 Format

```json
{
  "about": "…",
  "format": 1,
  "arch": "x64",
  "root": "",
  "generated": "2026-10-29",
  "bios": [],
  "drivers": [
    {
      "path": "Panasonic\\FZ-55\\FZ-55 MK1\\Video\\iigd_dch.inf",
      "description": "Intel(R) Iris(R) Xe Graphics",
      "provider": "Intel Corporation",
      "class": "Display",
      "version": "31.0.101.5186",
      "date": "2024-01-10",
      "hardwareIds": ["PCI\\VEN_8086&DEV_9A49"]
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | no | Catalog format version. Currently `1`. |
| `arch` | no | `x64` for 64-bit Windows. If it doesn't match the computer, WinDiag refuses the catalog. |
| `root` | no | The driver folder. Empty = the folder that contains the `.json` (recommended). |
| `generated` | no | Date the catalog was created. Informative only. |
| `drivers[].path` | **yes** | The `.inf`, relative to `root`. In JSON, each `\` is written as `\\`. |
| `drivers[].version` | **yes** | The `DriverVer` version of the `.inf`. |
| `drivers[].hardwareIds` | **yes** | The hardware IDs the `.inf` installs on. |
| `drivers[].date` | no | The `DriverVer` date (`YYYY-MM-DD`). Breaks ties between equal versions. |
| `description`, `provider`, `class` | no | Shown in the app. |

Entries missing a required field are ignored, so you can add or remove entries by hand. Get a device's hardware IDs from *Device Manager → the device → Properties → Details → Hardware Ids*. In most cases, though, it's easier to put the driver in the folder and run **Create catalog…** again.

---

## 5. BIOS updates

BIOS updates are installers, not `.inf` files, so they are **only offered from a catalog**, never when comparing a plain folder.

### 5.1 Where to put the updaters

Put each updater in a folder that has **"BIOS" in its name**, under `<manufacturer>\<model>\…`:

```
02 Drivers\Panasonic\CF-33\CF-33 MK2\BIOS\BIOS_33_V200L24.exe
```

**Create catalog…** then adds an entry with:

- `manufacturer` taken from the level 1 folder (`Panasonic`);
- `model` taken from the level 2 folder (`CF-33`);
- `version` taken from the file name: Panasonic style (`V200L24` → `V2.00L24`) or dotted (`1.28.1`);
- for Panasonic, `installedPrefix` from the version's generation (`V2.`).

If the file name has no version, the entry is added with an empty `version` and is **ignored until you fill it in**.

### 5.2 Review every entry

The generated entries are a guess. Before using the catalog, check each one:

```json
{
  "manufacturer": "Panasonic",
  "model": "CF-33",
  "sku": "",
  "version": "V2.00L24",
  "installedPrefix": "V2.",
  "path": "Panasonic\\CF-33\\CF-33 MK2\\BIOS\\BIOS_33_V200L24.exe",
  "arguments": "",
  "notes": ""
}
```

| Field | Required | Meaning |
|---|---|---|
| `model` | **yes** | Matched against the start of the Windows model, ignoring dashes and spaces (`FZ-55` matches `FZ55-1`). |
| `version` | **yes** | The BIOS version the updater installs. `V200L24` and `V2.00L24` are equivalent. |
| `path` | **yes** | The updater (`.exe`, `.cmd` or `.bat`), relative to `root`. |
| `manufacturer` | no | Must appear in the Windows manufacturer name. |
| `sku` | no | Must appear in the system SKU. Use it when two sub-models share a model name but need different BIOS files. |
| `installedPrefix` | no | How the installed BIOS version must start for this update to be offered. For Panasonic, the generation: `V1.` = MK1, `V2.` = MK2. |
| `arguments` | no | Parameters passed to the updater. |
| `notes` | no | Free text for you. |

**Panasonic generations:** the Windows model ends in the generation (`FZ55-1` = MK1, `CF-33-2` = MK2) and the first number of the BIOS version is the same generation (`V1.` = MK1). WinDiag only offers a BIOS when both agree, so a BIOS for another generation is never offered.

Files in the BIOS folder that aren't BIOS updaters (EC firmware, tools…) are also added. Delete those entries or leave their `version` empty.

### 5.3 Before the update runs

WinDiag refuses to start the updater if the computer is on battery only, suspends BitLocker for one restart, and asks for confirmation. The updater runs from the server, so **the network must stay available until the updater has loaded**. If the updater is large or the network is unreliable, copy the computer's BIOS folder to a USB drive and use a catalog there.

---

## 6. Preparing drivers that come as `.exe` or `.zip`

Most manufacturers ship drivers as self-extracting `.exe` files. WinDiag needs the extracted `.inf` package:

- **`.zip`:** extract it into its own folder.
- **Dell** (Dell Update Packages): `Driver.exe /s /e=C:\Extract\Driver`.
- **Intel, Realtek and others:** many accept `/extract`, `-x` or similar; check `/?`. Otherwise run the installer until its first screen and copy the extracted files from `%TEMP%`.
- **Driver packs** (for example, Dell Command | Deploy CAB files or Panasonic driver packs) already contain extracted `.inf` folders; extract the pack and copy those folders.

Keep the original installer next to the extracted folder if you like: WinDiag ignores it.

---

## 7. Checklist

- [ ] Every driver is extracted: an `.inf` with its `.sys`/`.cat` files next to it.
- [ ] Old versions you don't want offered are in folders ending in `- OLD`.
- [ ] BIOS updaters are in folders with "BIOS" in the name, under `<manufacturer>\<model>`.
- [ ] `drivers-catalog.json` is at the root of the driver folder, with `"root": ""`.
- [ ] Every `bios` entry was reviewed (model, version, `installedPrefix`, `sku`).
- [ ] The catalog was created again after the last change to the folder.
- [ ] Each computer has the server credentials saved (`cmdkey`) and uses the `\\SERVER\…` path, not a drive letter.

---

## 8. Troubleshooting

| Problem | Cause and fix |
|---|---|
| `"…" can't be opened` | The path is wrong, the network is down, the path uses a mapped letter, or the credentials aren't saved. Open the UNC path in File Explorer to check. |
| `The catalog lists x86 drivers, but this system is x64` | The catalog's `arch` doesn't match. Create it again from a 64-bit computer. |
| `The driver file can't be reached` | The catalog lists a driver that was moved or deleted. Create the catalog again. |
| A driver in the folder is never offered | It is a `.exe`/`.zip`, it is in a `- OLD` folder, its `.inf` has no `NTamd64` section, the catalog is older than the driver, or the installed version is already the same or newer. |
| `pnputil couldn't install the driver` | Usually a file of the package is missing next to the `.inf`, or the driver isn't signed. Copy the whole extracted folder again. |
| "Windows kept version X…" | The driver was added, but Windows prefers the one it has (for example a signed OEM driver or a more specific match). It is not an error. |
| No BIOS update is offered | Comparing a folder instead of a catalog, the entry has no `version`, `model`/`installedPrefix`/`sku` don't match this computer, or the installed BIOS is already the same or newer. |
