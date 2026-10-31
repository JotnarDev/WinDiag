# WinDiag website

The promotional site for WinDiag. React 19, Vite 7, Tailwind CSS 4, Fluent UI icons and Motion.

```bash
cd website
npm install
npm run dev      # local server with hot reload
npm run build    # static site in website/dist
npm run preview  # serve the build
```

The build uses relative paths (`base: './'`), so `dist/` works from any folder, including GitHub Pages.

## Text and languages

All text lives in `src/i18n/locales/`. English (`en.js`) is complete. To add Spanish:

1. Fill `src/i18n/locales/es.js` with the same keys as `en.js`. Any key left out falls back to English.
2. Set `ready: true` for `es` in `LOCALES` in `src/i18n/index.jsx`.

The language switch in the header appears by itself once two languages are ready. A visitor can also pick
a language with `?lang=es`; otherwise the site uses the last choice or the browser's language.

## Data shown on the page

- The BIOS and EC versions in the rugged laptops section are the latest on each maker's support site,
  checked on 29 October 2026 (`src/components/Rugged.jsx`).
- The test results (Toughbook FZ-55 MK2) and the driver versions in the comparison are examples.

## Photographs

All photographs come from Wikimedia Commons under Creative Commons licences. Their sources and
licences are in `public/photos/credits.json`, and the credit line is in the footer.
