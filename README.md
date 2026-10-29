# WinDiag Fluent

Herramienta de diagnóstico y preparación de equipos Windows, con diseño Fluent (Windows 11). La usa un técnico para probar el hardware de un equipo, instalarle drivers y BIOS y dejarlo listo para entregar. Está pensada sobre todo para portátiles rugerizados: Panasonic Toughbook, Getac y Dell Latitude Rugged.

- **Versión actual:** 2.5.0. Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md) y dentro de la app, en Settings → About.
- **Autor:** JOTNAR.
- **Stack:** Electron 44 · electron-vite 5 · React 19 · Tailwind CSS 4 · Fluent UI icons · systeminformation.

> Si eres una IA o un desarrollador que va a continuar el proyecto, lee también [HANDOFF.md](HANDOFF.md): explica cómo se hizo cada versión, las decisiones tomadas y las reglas de trabajo.

---

## Contenido

1. [Funciones](#funciones)
2. [Requisitos](#requisitos)
3. [Uso](#uso)
4. [Drivers, catálogo y BIOS](#drivers-catálogo-y-bios)
5. [Configuración (Settings)](#configuración-settings)
6. [Desarrollo](#desarrollo)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Versionado](#versionado)
9. [Solución de problemas](#solución-de-problemas)

---

## Funciones

La app tiene un panel de navegación con tres grupos de páginas.

### Overview

Ficha técnica del equipo:
- fabricante, modelo y número de serie;
- procesador, memoria (por módulo), almacenamiento, gráficos, batería, BIOS y Windows;
- estado de activación de Windows;
- botón **Copy specs**, que copia la ficha como texto (útil para tickets).

En los Panasonic muestra el nombre que usan los técnicos. Por ejemplo, `FZ55-1` se ve como **FZ-55 MK1**, con el código original debajo.

### Hardware tests

| Página | Qué prueba |
|---|---|
| **Display** | Llena la pantalla de colores sólidos para encontrar píxeles muertos o pegados, fugas de luz y retroiluminación irregular. |
| **Touch** | Dibuja el rastro de cada punto de contacto para revisar la precisión, la continuidad y el multitáctil. Muestra cuántos toques simultáneos detecta y bloquea los gestos de borde de Windows durante la prueba. |
| **Keyboard & mouse** | Hay que presionar cada tecla y cada botón del mouse. Las teclas se reconocen por posición física, así que sirve con cualquier idioma de teclado. Mientras la prueba está al frente, bloquea Windows, Print Screen, Esc, Alt+Tab y las teclas de bloqueo (se puede desactivar en Settings). |
| **Audio & camera** | Vista previa de la cámara, nivel del micrófono y tono de prueba por canal de altavoz. |
| **Battery** | Carga, estado, salud (capacidad de diseño contra capacidad real), ciclos, historial de carga y detalle de cada batería. |
| **Disk health** | Estimación de la vida restante del disco principal según los contadores de confiabilidad de Windows: desgaste, temperatura, horas de uso y errores. |
| **USB ports** | Detecta los puertos USB-A y USB-C del equipo y comprueba que cada uno reconozca un dispositivo. |
| **Wireless & peripherals** | Wi-Fi, Bluetooth, banda ancha móvil (4G), lector de tarjetas inteligentes, GPS y lector de código de barras o QR, cuando el equipo los tiene. |

### Tools

**Technician tools**
- **Windows Update:** un switch que lo desactiva de forma persistente (por políticas y por servicio). Muestra el estado real del servicio y se actualiza solo.
- **Activation:** estado de activación y un botón para ingresar o cambiar la clave de producto.
- **Reports:** reporte de salud de batería (`powercfg /batteryreport`) y de eficiencia energética (`powercfg /energy`).
- **Maintenance:** diagnóstico de memoria y revisión de disco (`chkdsk`) programada para el siguiente reinicio.
- **Windows utilities:** acceso directo a Sysprep, Device Manager, System Information, DirectX Diagnostic, Event Viewer, Resource Monitor, Disk Management, Optimize Drives, Disk Cleanup, System Configuration, System Restore, Programs and Features, Network Connections y Tablet PC calibration.

**Drivers**
- Compara los drivers instalados con una carpeta de drivers o con un catálogo `.json`, e instala los más nuevos o los que faltan.
- Compara la BIOS con la del catálogo y lanza el actualizador del fabricante.
- Está explicado en detalle en [Drivers, catálogo y BIOS](#drivers-catálogo-y-bios).

**Users**
- Muestra las cuentas locales de Windows.
- Permite borrar cualquier cuenta excepto las integradas (Administrator, Guest…), con los mismos avisos que *Local Users and Groups*.
- Exige que Sysprep esté abierto, y el perfil de la cuenta se conserva en el disco.

---

## Requisitos

**Para usar la app**
- Windows 10 u 11 de 64 bits.
- Permisos de administrador: la app los pide al abrir, por UAC.
- La transparencia (Mica) requiere Windows 11 22H2 o posterior. En versiones anteriores el fondo es sólido.

**Para desarrollar**
- Node.js 20.19 o superior (se recomienda 22 LTS).
- npm.

---

## Uso

### Versión portable (zip)

1. Descomprime `WinDiag Fluent-X.Y.Z-win.zip` en cualquier carpeta o en una memoria USB.
2. Ejecuta `windiag-fluent.exe` y acepta el aviso de UAC.

No necesita instalación. La configuración se guarda en un `settings.json` dentro de la carpeta de datos de la app, en `%APPDATA%`.

### Atajos

| Dónde | Tecla | Acción |
|---|---|---|
| Display | **→** / **Espacio** · **←** | Color siguiente / color anterior |
| Touch | **Espacio** | Limpiar los trazos |
| Display / Touch | **Esc** | Salir de la prueba a pantalla completa |
| Panel de navegación | **Esc** | Cerrar el panel cuando está en modo superpuesto |

---

## Drivers, catálogo y BIOS

### Comparar con una carpeta

1. La app busca una carpeta `02 Drivers` en la raíz de todas las unidades, o puedes elegir otra con **Browse…**.
2. **Compare drivers** lee todos los `.inf` de la carpeta (las carpetas que terminan en `- OLD` se omiten). Luego compara sus hardware IDs y versiones con los dispositivos del equipo.
3. Los resultados salen en tres grupos:
   - **Updates available:** con **Update** por dispositivo y **Update all**.
   - **Missing drivers:** dispositivos sin driver.
   - **Up to date.**
4. La instalación usa `pnputil /add-driver <inf> /install`. Después la app vuelve a leer la versión del dispositivo y avisa si Windows se quedó con otro driver que considera mejor o si hace falta reiniciar.

Solo se pueden comparar los drivers en formato `.inf`. Los instaladores `.exe` o `.zip` se omiten.

### Catálogo `.json` (recomendado para servidores)

Leer cientos de `.inf` por la red es lento. El catálogo es un solo archivo con la lista de drivers, y la app solo vuelve al servidor para instalar.

- **Crear o actualizar:** en la página Drivers, **Create catalog…** escanea la carpeta y guarda `drivers-catalog.json`, por defecto dentro de la misma carpeta.
- **Usar:** en **Settings → Drivers → Driver catalog**, escribe la ruta o elígela con **Browse…**.
- **Ruta de red:** usa la ruta completa `\\servidor\recurso\02 Drivers\drivers-catalog.json`. Las letras mapeadas (Z:, etc.) no funcionan porque la app corre como administrador. Si el recurso pide credenciales, guárdalas en el Administrador de credenciales de Windows.

Formato:

```json
{
  "format": 1,
  "arch": "x64",
  "root": "",
  "generated": "2026-10-29",
  "bios": [],
  "drivers": [
    {
      "path": "Panasonic\\FZ-55\\Video\\iigd_dch.inf",
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

- **`root`:** la carpeta de drivers. Si está vacío, las rutas parten de la carpeta donde está el `.json`.
- **Edición a mano:** se pueden agregar o quitar entradas. Las que no tienen `path`, `version` o `hardwareIds` se ignoran. Los hardware IDs se copian del Administrador de dispositivos → Propiedades → Detalles → *Id. de hardware*.

### BIOS

Las BIOS son instaladores `.exe`, así que se comparan desde la lista `bios` del catálogo:

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

| Campo | Significado |
|---|---|
| `model` | Se compara con el inicio del modelo de Windows, sin contar guiones ni espacios (`FZ-55` coincide con `FZ55-1`). |
| `sku` | Opcional. Debe aparecer en el SKU del sistema; sirve para separar submodelos. |
| `version` | La versión que instala el actualizador. `V200L24` y `V2.00L24` son equivalentes. Si está vacía, la entrada se ignora. |
| `installedPrefix` | Opcional. Cómo debe empezar la versión instalada para que se ofrezca la actualización. |
| `path`, `arguments` | El actualizador (`.exe`, `.cmd` o `.bat`) y sus parámetros. |

**Generaciones de Panasonic:** el primer número de la versión de BIOS es la generación (`V1.` = MK1, `V2.` = MK2), y el modelo de Windows termina en ella (`FZ55-1` = MK1). La app solo ofrece una BIOS si las dos coinciden. Así nunca propone la BIOS de otra generación.

**Antes de lanzar el actualizador, la app:**
- se niega si el equipo está solo con batería;
- suspende BitLocker por un reinicio, para que no pida la clave de recuperación;
- pide confirmación.

El actualizador del fabricante muestra su propia ventana y es el que reinicia el equipo.

**Create catalog…** agrega como BIOS los `.exe` que encuentra en carpetas con "BIOS" en el nombre, y saca la versión del nombre del archivo. Al guardar encima de un catálogo existente, conserva las entradas de BIOS que ya tenía. **Revisa siempre las entradas de BIOS generadas antes de usarlas.**

---

## Configuración (Settings)

| Opción | Valores | Por defecto |
|---|---|---|
| App theme | Use system setting / Light / Dark | Sistema |
| Transparency effects | Mica activado o desactivado (Windows 11 22H2+) | Activado |
| Color palette | Windows, Ocean, Forest, Sunset, Grape, Slate, Custom | Windows |
| Custom accent color / background tint | Cualquier color (solo con Custom) | `#0078D4` / sin tinte |
| Start page | Cualquier página | Overview |
| Block system keys in the keyboard test | Sí / No | Sí |
| Driver catalog | Ruta del `.json` (local o `\\servidor\...`) | Vacío (lee la carpeta) |

- **Reset settings** devuelve todo a los valores por defecto.
- Settings → About muestra la versión y, al expandirlo, los cambios de cada versión.

---

## Desarrollo

```bash
npm install
npm run dev          # modo desarrollo con recarga en caliente
npm run build        # compila main, preload y renderer en out/
```

Generar la versión de Windows:

```bash
# zip portable → dist/WinDiag Fluent-<versión>-win.zip
npx electron-vite build && npx electron-builder --win zip --x64

# instalador NSIS → dist/windiag-fluent-<versión>-setup.exe
npm run build:win
```

**Notas:**
- **Compilar desde Linux:** el zip de Windows se genera igual. La app solo funciona en Windows, porque casi todo usa PowerShell y WMI.
- **Desarrollo en otro sistema:** las funciones de Windows devuelven "no compatible" o datos vacíos.
- **Paquete:** el `.exe` pide administrador (`requestedExecutionLevel: requireAdministrator`) y solo incluye los idiomas de Chromium `en-US`, `es` y `es-419`, para reducir el tamaño.
- **Equipos con pocos recursos:** la app está pensada para equipos con 4 GB de RAM y escala de pantalla del 150 %. Evita los procesos persistentes y las dependencias pesadas, y prueba el canvas y el touch con DPR 1.5.

---

## Estructura del proyecto

```
src/
  main/                         Proceso principal (Node/Electron)
    index.js                    ventana, Mica, acento, IPC (handle() valida el origen)
    powershell.js               sesión PowerShell compartida y ejecución aislada
    settings.js                 settings.json con validación por esquema
    system-info.js              ficha técnica, datos en vivo, activación
    system-tools.js             Windows Update, reportes, elevación, Sysprep, chkdsk
    drivers.js                  escaneo, pnputil, BIOS, crear catálogo
    inf-parser.js               lector de .inf (funciones puras)
    driver-catalog.js           catálogo JSON, BIOS, versiones (funciones puras)
    device-model.js             nombres de modelos Panasonic (funciones puras)
    keyboard-hook.js            hook de teclado de bajo nivel (C# vía PowerShell)
    users.js                    cuentas locales
    ports.js                    puertos USB
    other-devices.js            radios, smart card, GPS, escáner
    disk-health.js              salud del disco principal
    edge-gestures.js            bloqueo de gestos de borde en la prueba táctil
  preload/index.js              window.api: un método por canal IPC
  renderer/src/
    main.jsx                    aplica apariencia y paleta antes del primer render
    App.jsx                     mapa de páginas (MODULES)
    components/
      AppShell.jsx              barra de título y panel de navegación (NAV_GROUPS)
      Page.jsx
      ui/                       Button, Card/SettingsCard/Expander, InfoBar/Badge/
                                ToggleSwitch/ContentDialog, Select/TextBox
    context/                    SettingsContext, SystemInfoContext
    lib/                        palette.js, changelog.js, utils.js
    modules/                    una página por archivo (Overview, Drivers, Settings…)
    assets/main.css             tokens Fluent (claro/oscuro), tinte de paleta
CHANGELOG.md                    historial de versiones (lo lee Settings → About)
HANDOFF.md                      guía para quien continúe el proyecto
electron-builder.yml            empaquetado de Windows
```

**Agregar una página:**
1. Crear el módulo en `modules/`.
2. Agregarlo a `MODULES` (`App.jsx`) y a `NAV_GROUPS` (`AppShell.jsx`).
3. Agregar su id a `PAGE_IDS` en `src/main/settings.js`.

**Agregar una llamada al sistema:**
1. `handle('canal', …)` en `src/main/index.js`.
2. El método en `src/preload/index.js`.
3. Llamarlo desde el renderer con `window.api.metodo()`.

---

## Versionado

El proyecto sigue [Semantic Versioning](https://semver.org/lang/es/):

- **Major:** un rediseño o un cambio que rompe cómo se usa la app. 2.0.0 fue el paso a Fluent.
- **Minor:** una función o página nueva. El patch vuelve a 0.
- **Patch:** la corrección de algo que ya existía.

**En cada cambio:**
1. Subir la versión con `npm version X.Y.Z --no-git-tag-version`.
2. Agregar la entrada al principio de `CHANGELOG.md` con este formato:
   ```
   ## X.Y.Z — AAAA-MM-DD

   ### Added | Fixed | Changed
   - Una línea por cambio.
   ```
   No cambies el formato: Settings → About lo lee para mostrar las notas de versión.
3. Compilar el zip, que lleva la versión en el nombre.

| Versión | Cambio principal |
|---|---|
| 2.5.0 | Notas de versión en Settings → About |
| 2.4.0 | Paletas de colores |
| 2.3.4 | Detección de activación más rápida |
| 2.3.3 | El switch de Windows Update refleja el servicio real |
| 2.3.2 | Arreglo de "launchBiosUpdate is not defined" |
| 2.3.1 | Modelos Panasonic y control de generación de BIOS |
| 2.3.0 | Actualización de BIOS |
| 2.2.0 | Catálogo de drivers `.json` |
| 2.1.0 | Página Drivers |
| 2.0.0 | Rediseño Fluent |

---

## Solución de problemas

| Problema | Causa y solución |
|---|---|
| "Administrator permission is required…" | Abre la app como administrador. El `.exe` ya lo pide; si lo abriste de otra forma, usa *Run as administrator* en el panel. |
| No encuentra la carpeta o el catálogo en un servidor | Usa la ruta `\\servidor\recurso\...`, no una letra mapeada. Revisa la red y las credenciales guardadas. |
| "Windows kept version X…" al instalar un driver | El driver se agregó, pero Windows prefiere el que ya tiene (por ejemplo, un driver OEM firmado o con una coincidencia más específica). No es un error. |
| No ofrece la BIOS | Revisa en el catálogo que `model`, `version` e `installedPrefix` correspondan a la generación del equipo, y que la BIOS del catálogo sea más nueva que la instalada. |
| "Connect the AC adapter first" al actualizar la BIOS | Conecta el cargador: la app nunca lanza una actualización de BIOS solo con batería. |
| "Activation unknown" | Windows no respondió la consulta de licencia. Ejecuta `slmgr /xpr` para comprobarlo manualmente. |
| El switch de Windows Update vuelve a On | Windows (servicio *Update Medic*) reactivó el servicio. Apágalo de nuevo; las políticas siguen bloqueando las descargas. |
| No bloquea las teclas del sistema en la prueba de teclado | Revisa que esté activado en Settings → *Block system keys*. Si el hook no pudo iniciar, la página lo avisa. |
