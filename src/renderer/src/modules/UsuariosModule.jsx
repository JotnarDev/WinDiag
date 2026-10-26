import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const SYSPREP_POLL_MS = 3e3
function userTags(u) {
  const tags = []
  if (u.isCurrentUser) tags.push('You')
  if (u.isAdmin) tags.push('Administrator')
  if (!u.enabled) tags.push('Disabled')
  return tags
}

export function UsuariosModule() {
  const [users, setUsers] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [deletingName, setDeletingName] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [sysprepRunning, setSysprepRunning] = useState(null)
  const [openingSysprep, setOpeningSysprep] = useState(false)
  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await window.api.getWindowsUsers()
      setUsers([...data].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    let cancelled = false
    let timeoutId = null
    async function poll() {
      try {
        const running = await window.api.isSysprepRunning()
        if (!cancelled) setSysprepRunning(running)
      } catch {
        if (!cancelled) setSysprepRunning(false)
      } finally {
        if (!cancelled) timeoutId = setTimeout(() => void poll(), SYSPREP_POLL_MS)
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])
  const handleDelete = async (name) => {
    setDeletingName(name)
    setFeedback(null)
    const result = await window.api.deleteWindowsUser(name)
    setFeedback({
      text: result.message,
      isError: !result.success
    })
    setDeletingName(null)
    setConfirmingDelete(null)
    if (result.success) {
      void load()
    }
  }
  const handleOpenSysprep = async () => {
    setOpeningSysprep(true)
    await window.api.launchSystemTool('sysprep')
    setOpeningSysprep(false)
  }
  const isInitialLoad = users === null
  const sysprepReady = sysprepRunning === true
  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-zinc-500">
            Local Windows accounts. Deleting keeps the profile folder on disk.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          disabled={isLoading}
          onClick={() => void load()}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </header>
      {sysprepRunning === false && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-900/50 bg-amber-950/40 p-3">
          <p className="flex items-start gap-2 text-sm text-amber-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Sysprep must be open to delete a user account.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-800/60 bg-transparent"
            disabled={openingSysprep}
            onClick={() => void handleOpenSysprep()}
          >
            {openingSysprep ? 'Opening…' : 'Open Sysprep'}
          </Button>
        </div>
      )}
      {feedback && (
        <p className={cn('mb-3 text-sm', feedback.isError ? 'text-red-400' : 'text-emerald-400')}>
          {feedback.text}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-400">
          {'Could not read user accounts: '}
          {error}
        </p>
      )}
      {isInitialLoad && !error && (
        <p className="text-sm text-zinc-500">Reading local user accounts…</p>
      )}
      {users && users.length === 0 && !error && (
        <p className="text-sm text-zinc-500">No local user accounts were found.</p>
      )}
      {users && users.length > 0 && (
        <Card className="py-0">
          <CardContent className="divide-y divide-zinc-100 px-0">
            {users.map((u) => {
              const isProtected = u.name.toLowerCase() === 'administrator' || !u.enabled
              const isConfirming = confirmingDelete === u.name
              const isBusy = deletingName === u.name
              const tags = userTags(u)
              return (
                <div key={u.sid} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-zinc-100">{u.name}</span>
                    {tags.length > 0 && (
                      <span className="ml-2 text-xs text-zinc-400">{tags.join(' · ')}</span>
                    )}
                  </div>
                  {isConfirming ? (
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="text-zinc-500">
                        {'Delete "'}
                        {u.name}
                        {'"?'}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="font-medium text-red-400 hover:underline disabled:opacity-50"
                        onClick={() => void handleDelete(u.name)}
                      >
                        {isBusy ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="text-zinc-500 hover:underline disabled:opacity-50"
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : isProtected ? (
                    <span className="shrink-0 text-xs text-zinc-300">—</span>
                  ) : !sysprepReady ? (
                    <span
                      className="shrink-0 text-xs text-zinc-300"
                      title="Sysprep must be open first"
                    >
                      Delete
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-red-400 hover:underline"
                      onClick={() => setConfirmingDelete(u.name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
