import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/*
 * What each hardware test found during this session, for the Overview.
 * Results live until the app closes; nothing is saved to disk.
 *
 * Per test:
 * - verdict: 'pass' | 'fail' | null, set by the technician (TestVerdict)
 * - auto: { status: 'pass' | 'check' | 'fail', note } | null, set by tests
 *   that can judge on their own (disk health, every USB port detected)
 * - note: progress so far, such as "72 of 104 keys"
 */
const TestResultsContext = createContext(null)

export function TestResultsProvider({ children }) {
  const [results, setResults] = useState({})
  const update = useCallback((id, patch) => {
    setResults((prev) => {
      const current = prev[id] ?? {}
      const next = { ...current, ...patch }
      if (Object.keys(patch).every((key) => current[key] === next[key])) return prev
      return { ...prev, [id]: next }
    })
  }, [])
  const value = useMemo(() => ({ results, update }), [results, update])
  return <TestResultsContext.Provider value={value}>{children}</TestResultsContext.Provider>
}

function useTestResultsContext() {
  const ctx = useContext(TestResultsContext)
  if (!ctx) throw new Error('Test results need a TestResultsProvider')
  return ctx
}

export function useTestResults() {
  return useTestResultsContext().results
}

/** The technician's verdict for one test, and a setter (null clears it). */
export function useTestVerdict(id) {
  const { results, update } = useTestResultsContext()
  const setVerdict = useCallback((verdict) => update(id, { verdict }), [id, update])
  return [results[id]?.verdict ?? null, setVerdict]
}

/** Reports progress (a short note) for a test while its page is open. */
export function useTestProgress(id, note) {
  const { update } = useTestResultsContext()
  useEffect(() => {
    if (note) update(id, { note })
  }, [id, note, update])
}

/** Reports a result the test reached on its own; null leaves the last one. */
export function useTestAutoResult(id, auto) {
  const { update } = useTestResultsContext()
  const status = auto?.status
  const note = auto?.note
  useEffect(() => {
    if (status) update(id, { auto: { status, note: note ?? null } })
  }, [id, status, note, update])
}

/**
 * One test's state for display: the technician's verdict wins, then the
 * test's own result, then progress. Returns { status, note } where status is
 * 'pass' | 'check' | 'fail' | 'progress' | 'todo'.
 */
export function resolveTestResult(result) {
  if (!result) return { status: 'todo', note: null }
  if (result.verdict)
    return { status: result.verdict, note: result.auto?.note ?? result.note ?? null }
  if (result.auto) return { status: result.auto.status, note: result.auto.note }
  if (result.note) return { status: 'progress', note: result.note }
  return { status: 'todo', note: null }
}
