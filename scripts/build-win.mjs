// Builds the Windows installer and portable zip of one edition:
//   node scripts/build-win.mjs [bench|home] [extra electron-builder args]
// With no edition it builds Bench when its code is here, otherwise Home.
import { existsSync } from 'fs'
import { spawnSync } from 'child_process'

const args = process.argv.slice(2)
const hasBench = existsSync('src/renderer/src/bench/edition.js')
const edition = ['bench', 'home'].includes(args[0]) ? args.shift() : hasBench ? 'bench' : 'home'
if (edition === 'bench' && !hasBench) {
  console.error("The bench edition's code isn't in this repository.")
  process.exit(1)
}

const run = (command, commandArgs) => {
  const { status } = spawnSync(command, commandArgs, { stdio: 'inherit', shell: true })
  if (status !== 0) process.exit(status ?? 1)
}

console.log(`Building WinDiag ${edition}`)
run('npx', ['electron-vite', 'build', '--mode', edition])
run('npx', ['electron-builder', '--win', '--config', `electron-builder.${edition}.yml`, ...args])
