# WinDiag

Herramienta de diagnóstico de hardware para Windows (Electron + React + Tailwind).

> Proyecto reconstruido a partir del build `windiag-1.0.0` (`app.asar`). El original era
> TypeScript; los tipos no sobreviven a la compilación, así que esta versión es JavaScript/JSX
> con la misma lógica, textos, estilos y canales IPC.

## Requisitos

- Windows 10/11
- Node.js 20.19+ (recomendado 22 LTS)

## Uso

```bash
npm install
npm run dev        # modo desarrollo con recarga
npm run build:win  # genera dist/windiag-<version>-setup.exe
```

## Estructura

```
src/
  main/            Proceso principal (Electron, PowerShell/WMI)
    index.js         ventana, handlers IPC, teclado/táctil
    system-info.js   info estática/dinámica, ventiladores
    ports.js         USB y Ethernet
    other-devices.js smart card, GPS, escáner, radios, Wi-Fi
    system-tools.js  herramientas de Windows, servicios, informes, elevación
    users.js         cuentas locales
    disk-health.js   salud del disco principal
  preload/index.js API expuesta como window.api
  renderer/src/
    App.jsx          navegación entre módulos
    context/         SystemInfoProvider, PortsProvider
    modules/         una pantalla por módulo (Resumen, Pantalla, Táctil, ...)
    components/      Sidebar y componentes UI (shadcn)
    assets/main.css  tema Tailwind v4
```
