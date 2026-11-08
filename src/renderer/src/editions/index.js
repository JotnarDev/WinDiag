/* global __EDITION__ */
import { bench } from './bench'
import { home } from './home'

/** The edition this build is, chosen at build time (electron-vite --mode home). */
export const EDITION = __EDITION__ === 'home' ? home : bench
