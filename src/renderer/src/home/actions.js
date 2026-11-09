/** An error's own words, without Electron's "Error invoking remote method…". */
export function errorText(err, fallback) {
  const message = err?.message ?? ''
  return message.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '') || fallback
}

/** What went wrong with an action, in words; null when it worked. */
export function actionError(result) {
  if (result?.ok) return null
  if (result?.cancelled) return 'Nothing changed: Windows didn’t get administrator permission.'
  return result?.error || 'Windows didn’t accept the change.'
}
