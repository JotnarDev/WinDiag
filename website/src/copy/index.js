import text from './text'

/*
 * Every visible string on the page lives in ./text.js; components read it
 * with t('section.key'). Placeholders such as {version} are filled from vars.
 */
function lookup(path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), text)
}

export function t(path, vars) {
  const value = lookup(path)
  if (value === undefined) return path
  if (typeof value === 'string' && vars) {
    return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match))
  }
  return value
}

export const useCopy = () => ({ t })
