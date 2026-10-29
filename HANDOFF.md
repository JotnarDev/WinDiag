# WinDiag — resumen para una IA que continúe el proyecto

Este archivo explica qué se cambió en cada versión de WinDiag Fluent, cómo se hizo y qué reglas seguir. Léelo antes de tocar el código. El detalle de cada versión también está en `windiag-fluent/CHANGELOG.md`, que la app muestra en Settings → About.

---

## 1. Qué es

WinDiag es una herramienta de diagnóstico y preparación de equipos Windows, sobre todo portátiles rugerizados: Panasonic Toughbook (CF-19, CF-20, CF-31, CF-33, CF-54, CF-C2, FZ-55, FZ-A3, FZ-G1, FZ-M1), Getac y Dell Latitude Rugged. La usa un técnico (JOTNAR) para probar el hardware, instalar drivers y BIOS y dejar el equipo listo.

- **Stack:** Electron 44 + electron-vite 5 + React 19 + Tailwind 4. JavaScript, no TypeScript.
- **Diseño:** Fluent 2 / Windows 11, con iconos de `@fluentui/react-icons`.
- **Windows:** el main process consulta el sistema con PowerShell, a través de una sesión compartida (`src/main/powershell.js`) y de `systeminformation`.
- **Permisos:** la app corre siempre como administrador (`requireAdministrator` en `electron-builder.yml`).

### Solo se mantiene la versión Fluent

`windiag-fluent/` (rama git `fluent-ui`, versión **2.5.0**) es el único proyecto que se mantiene. El usuario solo necesita esta versión ("con fluent es mucho más fluido").

Empezó como una copia del WinDiag original (1.0.0, que sigue en la máquina de desarrollo en la rama `windows-integration`). Ese proyecto ya no se desarrolla ni se copia a las memorias, así que **no hay que pasarle los cambios**.

### Identidad de la variante Fluent

- appId `com.jotnar.windiag.fluent`
- productName `WinDiag Fluent`
- ejecutable `windiag-fluent.exe`
- `setAppUserModelId('com.jotnar.windiag.fluent')`

La identidad es distinta de la original para que las dos puedan convivir instaladas.

---

## 2. Cómo se maneja el versionado (SemVer)

Las reglas las pidió el usuario y se aplican en cada cambio:

- **Major:** un rediseño o un cambio que rompe cómo se usa la app. **2.0.0 = el paso a Fluent.**
- **Minor:** una función o página nueva. El patch vuelve a 0.
- **Patch:** la corrección de algo que ya existía.

**Procedimiento en cada cambio:**
1. Hacer el cambio.
2. Subir la versión con `npm version X.Y.Z --no-git-tag-version`, que actualiza `package.json` y `package-lock.json`.
3. Agregar la entrada al principio de `CHANGELOG.md`, siguiendo el formato existente: `## X.Y.Z — AAAA-MM-DD`, luego `### Added` / `### Fixed` / `### Changed` y viñetas `- ` de una línea. **Este formato no se puede cambiar:** `src/renderer/src/lib/changelog.js` lo lee con regex para mostrarlo en Settings → About.
4. Compilar y generar el zip. El nombre lleva la versión: `dist/WinDiag Fluent-X.Y.Z-win.zip`.
5. Decirle al usuario en qué versión quedó.

`__APP_VERSION__` sale de `package.json` (vía `electron.vite.config.mjs`) y se muestra en el pie del menú y en Settings → About.

---

## 3. Qué cambió en cada versión y cómo se hizo

### 2.0.0 — Paso a Fluent (major)

Se reescribió toda la interfaz con el estilo de Windows 11.

- **Ventana:**
  - `titleBarStyle: 'hidden'` con `titleBarOverlay` de 48 px; Windows dibuja los botones de minimizar, maximizar y cerrar.
  - Mica (`backgroundMaterial`) cuando el build es ≥ 22621 y la transparencia está activada.
  - El tamaño sale del área de trabajo de la pantalla: máximo 1100×760 y mínimo 640×480, porque la mayoría de equipos usan escala del 150 %.
- **Navegación:** `components/AppShell.jsx` contiene la barra de título y un NavigationView con los grupos de `NAV_GROUPS`: Overview, *Hardware tests* y *Tools*. Debajo de 1008 px de ancho el panel se compacta o pasa a overlay. En el pie están *Run as administrator*, *Settings* y la versión.
- **Componentes UI propios, sin librerías pesadas:**
  - `components/ui/Button.jsx`, con variantes accent, standard, subtle y danger.
  - `components/ui/Card.jsx`: Card, Section, SettingsCard (con prop `stacked` desde 2.4.0), Expander y PropertyList.
  - `components/ui/feedback.jsx`: InfoBar, Badge, ProgressBar, ProgressRing, ToggleSwitch y ContentDialog (sobre `<dialog>` nativo).
  - `components/ui/inputs.jsx`: Select y TextBox.
  - `components/Page.jsx`.
- **Tokens de color:** están en `assets/main.css`, para claro y oscuro. Los tonos del acento se derivan con `oklch(from var(--accent) L c h)`. También cubre `forced-colors` y `prefers-reduced-motion`.
- **Settings:**
  - `src/main/settings.js` guarda un JSON en `userData/settings.json`. Su objeto `SCHEMA` valida cada clave, y lo que no es válido se descarta.
  - IPC: `settings:get`, `settings:update` y `settings:reset`.
  - `SettingsContext` en el renderer.
  - `main.jsx` espera a tener la apariencia y los settings antes del primer render, para que la ventana no parpadee.
- **Páginas:** se reescribieron todas en Fluent.
  - Se creó **Technician tools** (`ToolsModule`), que reúne Windows Update, activación, reportes y utilidades.
  - Se eliminaron lucide-react, class-variance-authority y los componentes shadcn.
- **Users:**
  - Se puede borrar cualquier cuenta excepto las integradas, incluida la del usuario actual. Las integradas se detectan por el RID del SID: 500, 501, 503 y 504.
  - Se muestran los mismos mensajes que *Local Users and Groups* (lusrmgr) de Windows.
  - Sigue siendo obligatorio que Sysprep esté abierto.
- **Teclado:** `keyboard-hook.js` es un hook WH_KEYBOARD_LL en un proceso PowerShell propio (C# con Add-Type). Mientras la prueba de teclado está al frente, bloquea Windows, Print Screen, Esc, Alt+Tab y las teclas de bloqueo. Incluye la corrección de Right Shift (scan 0x36 con la marca *extended*).

### 2.1.0 — Página Drivers (minor)

Compara los drivers instalados con una carpeta de drivers e instala los más nuevos.

- **`src/main/inf-parser.js` (funciones puras, sin Electron):**
  - Lee un `.inf` en UTF-16 con o sin BOM, UTF-8 o latin1.
  - Saca `DriverVer` (resuelve las `%strings%`), el proveedor, la clase y los hardware IDs de las secciones de modelos que aplican a la arquitectura. En x64 solo cuentan las secciones `NTamd64`; las que no tienen decoración se ignoran, lo que de paso descarta drivers de XP.
- **`src/main/drivers.js`:**
  - Busca `X:\02 Drivers` en todas las unidades.
  - Recorre la carpeta hasta 12 niveles y se salta las carpetas que terminan en `- OLD`.
  - Parsea los `.inf` con concurrencia 8 y guarda una caché en memoria por tamaño y fecha del archivo.
  - Hace **una sola** consulta PowerShell que cruza Win32_PnPEntity (hardware y compatible IDs, código de error) con Win32_PnPSignedDriver (versión, fecha, inf).
- **Emparejamiento:**
  - Compara los hardware IDs del dispositivo con los del `.inf`.
  - Los compatible IDs solo se usan si el dispositivo no tiene driver.
  - Gana el candidato más nuevo: primero por versión y, si empatan, por fecha.
  - Cada dispositivo queda como `outdated`, `missing` (sin driver o con error 28) o `current`.
- **Instalación:**
  - Usa `pnputil /add-driver <inf> /install`. El código 3010 significa que hace falta reiniciar; el 259 significa que no se aplicó.
  - Después vuelve a leer la versión del dispositivo. Si no cambió, avisa que Windows se quedó con el driver que considera mejor.
  - **Solo acepta `.inf` encontrados en el último escaneo** (`scannedInfPaths`).
- **UI (`DriversModule.jsx`):** secciones *Updates available* (con *Update all*), *Missing drivers* y un expander *Up to date*. El último resultado se guarda en una variable del módulo, para no perderlo al cambiar de página.
- **IPC:** `drivers:find-default-folder`, `drivers:choose-folder`, `drivers:scan` y `drivers:install`.

### 2.2.0 — Catálogo `.json` (minor)

Sirve para no leer 440 `.inf` por la red cuando los drivers están en un servidor.

- **`src/main/driver-catalog.js` (funciones puras):** `catalogEntry`, `buildCatalog` y `parseCatalog`. El formato es:

  ```json
  {
    "about": "...",
    "format": 1,
    "arch": "x64",
    "root": "",
    "generated": "AAAA-MM-DD",
    "bios": [ ... ],
    "drivers": [
      {
        "path": "rel\\a.inf",
        "description": "...",
        "provider": "...",
        "class": "...",
        "version": "1.2.3.4",
        "date": "AAAA-MM-DD",
        "hardwareIds": ["PCI\\VEN_..."]
      }
    ]
  }
  ```

  Un `root` vacío significa que las rutas parten de la carpeta del `.json`. Las entradas sin path, version o hardwareIds se ignoran, así que el usuario puede agregar o quitar entradas a mano.
- **Settings:** clave `driverCatalog`, con un campo de ruta y un botón Browse… en Settings → Drivers.
- **Página Drivers:**
  - *Compare with* muestra el catálogo (si hay uno) y la carpeta.
  - *Create catalog…* escanea la carpeta y guarda el `.json`, por defecto dentro de la misma carpeta.
  - Después de crearlo aparece el botón *Use this catalog*.
- **Rutas de red:** se recomienda usar `\\servidor\recurso` y no letras mapeadas, porque una app elevada no ve las unidades mapeadas por el usuario. Los mensajes de error lo explican.
- **Catálogo real:** está en la memoria **MIKE 2**, en `02 Drivers/drivers-catalog.json` (212 drivers, 8683 IDs y 10 BIOS).

### 2.3.0 — Actualización de BIOS (minor)

- Las BIOS son `.exe` y no `.inf`, así que solo se comparan desde la lista `"bios"` del catálogo:

  ```json
  {
    "manufacturer": "Panasonic",
    "model": "CF-33",
    "sku": "",
    "version": "V2.00L24",
    "installedPrefix": "V2.",
    "path": "Panasonic\\CF-33\\CF-33 MK2\\BIOS_33_V200L24.exe",
    "arguments": "",
    "notes": ""
  }
  ```

- **Datos del equipo:** la consulta de dispositivos también devuelve el `system` (Win32_ComputerSystem para Manufacturer, Model y SystemSKUNumber; Win32_BIOS para SMBIOSBIOSVersion y ReleaseDate).
- **Comparación:** `matchBios` y `compareBiosVersions` comparan los grupos numéricos de la versión.
- **`launchBiosUpdate(path)`:**
  - Solo acepta el updater que ofreció el último escaneo.
  - Se niega si el equipo está solo con batería (`si.battery()`).
  - Suspende BitLocker por un reinicio (`Suspend-BitLocker -RebootCount 1`). Si no se pudo y BitLocker está activo, se detiene.
  - Lanza el `.exe` desacoplado (`spawn` detached). Los `.cmd` y `.bat` se lanzan con `cmd /d /s /c`.
- **UI:** una tarjeta *BIOS* en la página Drivers y un ContentDialog de confirmación con las advertencias.
- **Create catalog…:** agrega como BIOS los `.exe` que encuentra en carpetas con "bios" en el nombre (`guessBiosEntry`). Saca la versión del nombre del archivo. Al guardar encima de un catálogo existente, **conserva las entradas de BIOS que ya tenía**, porque se revisan a mano.

### 2.3.1 — Modelos Panasonic y generación (patch)

- **El problema:** Panasonic guarda el modelo como `<modelo>-<generación>`, por ejemplo `FZ55-1` = FZ-55 MK1, `CF-33-2` = MK2 y `CF-54-3` = MK3. Además, en las versiones de BIOS de Panasonic el primer número es la generación (`V1.00L31` = MK1). Los archivos usan la forma `V100L31`, mientras que Windows reporta `V1.00L31`.
- **`src/main/device-model.js`:** `friendlyModel()` convierte `FZ55-1` en `FZ-55 MK1`. Overview muestra el nombre amigable y debajo el *Model ID* original, y la tarjeta BIOS hace lo mismo.
- **`driver-catalog.js`:**
  - `normalizeBiosVersion()` convierte `V100L31` en `V1.00L31`.
  - `normalizeModel()` deja solo letras y números, así `FZ-55` coincide con `FZ55-1`.
  - `installedPrefix` exige que la BIOS instalada empiece así.
  - **Doble verificación:** la generación del modelo (`-1`) tiene que coincidir con la de `installedPrefix` (`V1.`). Si algo no cuadra, no se ofrece ninguna BIOS.

### 2.3.2 — Error `launchBiosUpdate is not defined` (patch)

- **Causa:** Prettier había juntado en una sola línea el `import { … } from './drivers'` de `src/main/index.js`. Un cambio posterior buscaba el texto con el formato de varias líneas, no lo encontró y no se aplicó. Faltaban `launchBiosUpdate`, `chooseCatalogFile` y `createCatalog`.
- **Lección:** después de editar con scripts, verifica que cada reemplazo se haya aplicado (con un `assert`) y corre la revisión de nombres indefinidos de la sección 5.

### 2.3.3 — Switch de Windows Update (patch)

- **Antes:** el estado se basaba en la política `NoAutoUpdate` y se leía una sola vez. Si Windows (*Update Medic*) volvía a encender el servicio, el switch seguía diciendo Off.
- **Ahora:**
  - `getWindowsUpdateState()` devuelve `{ state, running, startType, policy }` y marca *Off* solo si el servicio está detenido **y** en Disabled.
  - `ToolsModule` lo vuelve a consultar cada 5 s mientras la página está abierta, y pausa la consulta mientras aplica un cambio.
  - Muestra el detalle "Service running · startup Manual · blocked by policy".
- **Cómo se desactiva Windows Update (sin cambios):**
  - Las políticas en `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate` (NoAutoUpdate, UseWUServer, un WUServer falso en 127.0.0.1 y DoNotConnect…).
  - Además, `sc config wuauserv start= disabled` y `net stop`.

### 2.3.4 — Detección de activación (patch)

- **Antes:** la consulta listaba todas las `SoftwareLicensingProduct` y las filtraba en PowerShell. Tardaba más de 10 s, el timeout la mataba y la activación quedaba vacía.
- **Ahora:**
  - Una consulta WQL filtrada en WMI: `ApplicationID='55c92734-…' AND PartialProductKey IS NOT NULL`, con 60 s de timeout.
  - La lee el IPC aparte `system:get-activation`, y `SystemInfoContext` mete el resultado en `os.activated` cuando llega.
  - Mientras tanto, `os.activated` vale `undefined` y la app muestra "Checking activation…". El valor `null` significa "Activation unknown".

### 2.4.0 — Paletas de colores (minor)

- **`src/renderer/src/lib/palette.js`:**
  - `PALETTES`: Windows (el acento del sistema), Ocean, Forest, Sunset, Grape, Slate y Custom.
  - `applyPalette()` fija `--accent` y, si hay tinte, `--tint` y `data-tint` en `<html>`.
- **CSS:** `html[data-tint]` mezcla el tinte en `--solid-bg` y `--flyout` con `color-mix`. Con Mica, el tinte se aplica como una capa encima.
- **Settings:** claves `palette`, `customAccent` y `customTint` (`''` = sin tinte). La UI tiene muestras tipo radio, y Custom agrega `<input type=color>` que previsualiza en vivo y guarda 400 ms después de soltarlo.
- **Aplicación:** la paleta se aplica en `main.jsx` antes del primer render, en `SettingsContext` cuando cambian los settings y cuando cambia el acento de Windows.

### 2.5.0 — Notas de versión en About (minor)

- Settings → About ahora es un Expander que muestra todas las versiones. `lib/changelog.js` importa `CHANGELOG.md?raw` y lo parsea.

---

## 4. Estructura del código (Fluent)

```
src/main/
  index.js          ventana, apariencia (Mica/acento), IPC (handle() valida el origen)
  powershell.js     sesión PowerShell compartida (runPowerShell) y aislada
  settings.js       settings.json con SCHEMA
  system-info.js    specs estáticas/dinámicas, activación
  system-tools.js   Windows Update, reportes, elevación, sysprep, chkdsk
  drivers.js        escaneo, pnputil, BIOS, crear catálogo
  inf-parser.js     parser de .inf (puro)
  driver-catalog.js catálogo JSON, BIOS, versiones (puro)
  device-model.js   nombres Panasonic (puro)
  users.js, ports.js, other-devices.js, disk-health.js, edge-gestures.js, keyboard-hook.js
src/preload/index.js  window.api (cada método = un canal IPC)
src/renderer/src/
  App.jsx (mapa MODULES), main.jsx, components/, context/, lib/, modules/
```

**Para agregar una página:**
1. Un módulo en `modules/`.
2. Una entrada en `MODULES` (`App.jsx`) y en `NAV_GROUPS` (`AppShell.jsx`).
3. Su id en `PAGE_IDS` de `settings.js`.

**Para agregar un IPC:**
1. `handle('canal', …)` en `index.js`.
2. El método en `preload/index.js`.
3. La llamada `window.api.metodo()` en el renderer.

---

## 5. Cómo se trabajó

- **El desarrollo se hace en Linux**, así que nada específico de Windows se probó en Windows: Mica, el hook de teclado, pnputil, el actualizador de BIOS, BitLocker, Windows Update, borrar usuarios, etc. El usuario prueba en los equipos y reporta.
- **Compilar:** `npx electron-vite build && npx electron-builder --win zip --x64` genera `dist/WinDiag Fluent-X.Y.Z-win.zip`, que es portable. La copia en la memoria no trae `node_modules`: hay que hacer `npm install` antes. En la máquina de desarrollo, `windiag-fluent/node_modules/electron/dist` tenía un Electron de Linux descargado a mano, que solo servía para las capturas.
- **Revisión visual:** un script de Electron carga `out/renderer` con IPC simulado y saca capturas en claro, en oscuro y a distintos anchos. No está en el repo; estaba en el scratchpad de la sesión.
- **Revisión de nombres indefinidos:** ESLint con solo la regla `no-undef` sobre `src`. Además se verifica que cada `window.api.X` del renderer exista en el preload y que cada canal tenga su `handle`.
- **Formato:** Prettier (configuración del repo). Ojo: puede juntar o separar imports y romper un buscar-y-reemplazar.
- **Pruebas de funciones puras:** `inf-parser`, `driver-catalog` y `device-model` se probaron con Node sobre la carpeta real de drivers y con casos de Panasonic.

---

## 6. Reglas y preferencias del usuario

- El usuario escribe en español y se le responde en español. **Los textos de la app van en inglés.**
- **Commits solo cuando el usuario lo pide** ("haz el commit"). Los mensajes terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. El usuario de git es `jotnar`.
- Confirmar antes de borrar o sobrescribir, y revisar primero el destino.
- **Equipos objetivo:**
  - casi todos usan escala del 150 % (hay que probar canvas y touch con DPR 1.5);
  - pueden tener solo 4 GB de RAM, así que nada de procesos persistentes ni dependencias pesadas.
- **Memoria "MIKE 2"** (`/media/jotnar/MIKE 2` en Linux):
  - **Es la memoria de trabajo.** Los builds se guardan ahí siguiendo su `LEEME - Organizacion.txt`.
  - `01 Diagnostico y Utilidades/WinDiag (App) - ACTUAL <fecha>` es la versión en uso, y `Abrir WinDiag.bat` la lanza.
  - `04 Desarrollo y Pruebas/WinDiag - Build de prueba <fecha>` guarda los builds sin probar.
  - Lo viejo se renombra con el sufijo " - OLD".
  - No se toca ACTUAL ni el `.bat` sin que el usuario lo pida, y cada cambio se anota en el LEEME.
- **Nunca tocar `sdb`:** es el disco del sistema Linux.

---

## 7. Pendiente / sin probar

- **Sin probar en Windows:** todo lo de las versiones 2.x, en especial la instalación con pnputil, el actualizador de BIOS, BitLocker, las rutas de red, el switch de Windows Update, la activación y Mica con tinte.
- **Catálogo por revisar:**
  - CF-C2 tiene dos BIOS V2 (`V2.00L21` y `V2.50L16`); confirmar si la V2.50 es para otro submodelo y, si es así, usar `sku`.
  - `ec_33_1_m195057.exe` y `BiosUpdate_R18-0354.exe` quedaron sin versión, así que se ignoran.
- **Preguntas sin respuesta del usuario:**
  - ¿Guardar los datos de la app en una carpeta `data` junto al exe (versión portable)?
  - ¿Quitar el requisito de Sysprep para borrar usuarios?
  - Lo que se haga después del commit `e6b212e` (2.5.0) queda sin commitear hasta que el usuario lo pida.
