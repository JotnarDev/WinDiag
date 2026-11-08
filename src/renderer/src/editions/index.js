// The edition this build is, chosen at build time (electron-vite --mode).
// '@edition' points at src/renderer/src/bench/edition.js or ./home.js, so a
// build only contains its own edition's pages.
export { default as EDITION } from '@edition'
