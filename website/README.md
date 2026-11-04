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

## Text

The page is in English. All its text lives in `src/copy/text.js`, and components read it with
`t('section.key')` from `src/copy/index.js`.

## Look

The page follows the brand kit in [`/brand`](../brand/README.md): Carbon, Graphite and Paper grounds, Cyan
(`#22E3F2`) as the one accent, and Space Grotesk for headings (self-hosted in `src/fonts/`, SIL OFL 1.1).
Running text stays in Segoe UI, like the app. Dark is the default theme; visitors can switch to light or
follow the system. All colours are tokens at the top of `src/styles.css`; in light mode, accent text uses
Cyan Deep (`--accent-ink`, `#0E7490`) so it stays readable.

The logo in the header and footer is `src/components/Logo.jsx`, drawn from the masters in `brand/svg/`.
The favicons, app icons, `site.webmanifest` and `og-image.png` in `public/` come from the same kit.

## Data shown on the page

- The makers' logos in the brands section come from Simple Icons (CC0, `src/lib/brand-logos.js`); the brands belong to their owners.
- The test results (Toughbook FZ-55 MK2) and the driver versions in the comparison are examples.

## Photographs

All photographs come from Wikimedia Commons under Creative Commons licences. Their sources and
licences are in `public/photos/credits.json`, and the credit line is in the footer.
