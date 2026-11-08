import { useCallback, useEffect, useState } from 'react'
import { ArrowSyncRegular, DeleteRegular, OpenRegular } from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card, Section } from '@/components/ui/Card'
import { Badge, ContentDialog, InfoBar, ProgressRing } from '@/components/ui/feedback'

const SYSPREP_POLL_MS = 3e3

// Fluent PersonPicture: initials on a neutral circle
function Avatar({ name }) {
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-control-alt text-caption font-semibold text-text-secondary"
    >
      {initials || '?'}
    </span>
  )
}

function accountNote(user) {
  if (user.isBuiltIn) return 'Built-in account'
  if (user.isCurrentUser) return 'Signed in now'
  return null
}

export function UsersModule() {
  const [users, setUsers] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
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
  const handleDelete = async () => {
    const sid = pendingDelete.sid
    setDeleting(true)
    setFeedback(null)
    const result = await window.api.deleteWindowsUser(sid)
    setFeedback({ text: result.message, isError: !result.success })
    setDeleting(false)
    setPendingDelete(null)
    if (result.success) void load()
  }
  const handleOpenSysprep = async () => {
    setOpeningSysprep(true)
    await window.api.launchSystemTool('sysprep')
    setOpeningSysprep(false)
  }
  const sysprepReady = sysprepRunning === true
  return (
    <Page
      title="Users"
      description="Local Windows accounts on this device. Deleting an account keeps its profile folder on disk."
      actions={
        <Button icon={ArrowSyncRegular} disabled={isLoading} onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {sysprepRunning === false && (
          <InfoBar
            severity="warning"
            title="Sysprep must be open to delete an account."
            action={
              <Button
                icon={OpenRegular}
                disabled={openingSysprep}
                onClick={() => void handleOpenSysprep()}
              >
                {openingSysprep ? 'Opening…' : 'Open Sysprep'}
              </Button>
            }
          >
            Accounts are deleted while preparing the device, so WinDiag waits until Sysprep is
            running.
          </InfoBar>
        )}
        {feedback && (
          <InfoBar
            severity={feedback.isError ? 'error' : 'success'}
            onDismiss={() => setFeedback(null)}
          >
            {feedback.text}
          </InfoBar>
        )}
        {error && (
          <InfoBar severity="error" title="Couldn't read user accounts.">
            {error}
          </InfoBar>
        )}
      </div>
      {users === null && !error && (
        <Card className="flex items-center gap-3 px-4 py-5 text-text-secondary">
          <ProgressRing size={16} label="Reading accounts" />
          Reading local user accounts…
        </Card>
      )}
      {users && users.length === 0 && !error && (
        <p className="text-text-secondary">No local user accounts were found.</p>
      )}
      {users && users.length > 0 && (
        <Section title={`Accounts (${users.length})`} className="mt-6">
          {users.map((u) => {
            const note = accountNote(u)
            return (
              <Card
                key={u.sid}
                className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5"
              >
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="selectable truncate">{u.name}</p>
                  {note && <p className="text-caption text-text-secondary">{note}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.isCurrentUser && <Badge tone="accent">You</Badge>}
                  {u.isAdmin && <Badge>Administrator</Badge>}
                  {!u.enabled && <Badge>Disabled</Badge>}
                </div>
                <Button
                  icon={DeleteRegular}
                  disabled={!sysprepReady}
                  title={sysprepReady ? undefined : 'Open Sysprep first'}
                  onClick={() => setPendingDelete(u)}
                >
                  Delete
                </Button>
              </Card>
            )
          })}
        </Section>
      )}
      {/* Same messages as Local Users and Groups (lusrmgr.msc) */}
      <ContentDialog
        open={pendingDelete !== null && pendingDelete.isBuiltIn}
        title="Local Users and Groups"
        closeText="OK"
        onClose={() => setPendingDelete(null)}
      >
        The following error occurred while attempting to delete the user {pendingDelete?.name}:
        <br />
        <br />
        Cannot perform this operation on built-in accounts.
      </ContentDialog>
      <ContentDialog
        open={pendingDelete !== null && !pendingDelete.isBuiltIn}
        title="Local Users and Groups"
        primaryText={deleting ? 'Deleting…' : 'Yes'}
        primaryVariant="danger"
        onPrimary={() => void handleDelete()}
        closeText="No"
        onClose={() => setPendingDelete(null)}
        busy={deleting}
      >
        Each user account has a unique identifier in addition to their user name. Deleting a user
        account deletes this identifier and it cannot be restored, even if you create a new account
        with an identical user name. This can prevent the user from accessing resources they
        currently have permission to access.
        <br />
        <br />
        Are you sure you want to delete the user {pendingDelete?.name}?
      </ContentDialog>
    </Page>
  )
}
