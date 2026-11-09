import { useCallback, useEffect, useState } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowResetRegular,
  CheckmarkCircleFilled,
  ShieldRegular,
  SparkleRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing, ToggleSwitch } from '@/components/ui/feedback'
import { actionError, errorText } from './actions'

/*
 * Privacy: Windows features that share data or show ads, each with a switch
 * like the ones in Windows Settings. Turning one back on restores Windows'
 * own default.
 */

const GROUPS = [
  { id: 'sharing', title: 'What Windows shares with Microsoft' },
  { id: 'ads', title: 'Ads and suggestions' },
  { id: 'location', title: 'Location' },
  { id: 'ai', title: 'AI' }
]

// recommended: the state we suggest (false = off); null = up to you
const TEXT = {
  diagnostics: {
    title: 'Optional diagnostic data',
    text: 'Extra details about the apps you use, the websites you visit and how you use Windows, sent to Microsoft. Off: Windows sends only the data it requires.',
    recommended: false
  },
  tailored: {
    title: 'Tailored experiences',
    text: 'Microsoft uses your diagnostic data to show you personalised tips, ads and recommendations.',
    recommended: false
  },
  advertisingId: {
    title: 'Advertising ID',
    text: 'Apps can use it to show you ads based on what you do in other apps. Off: you still see ads, just less personal ones.',
    recommended: false
  },
  feedback: {
    title: 'Feedback requests',
    text: 'Windows now and then asks you to rate it or answer a question.',
    recommended: false
  },
  activity: {
    title: 'Activity history',
    text: 'Windows keeps a list of the files, websites and apps you used, to pick up where you left off on other devices.',
    recommended: false
  },
  webSearch: {
    title: 'Web results in search',
    text: 'Searching from Start or the taskbar also sends what you type to Bing and shows web results. Off: search shows only your apps, files and settings.',
    recommended: false
  },
  suggestedApps: {
    title: 'Suggested and promoted apps',
    text: 'Windows suggests apps in Start and can install promoted apps, such as games, by itself. Off: no suggestions or automatic installs; apps already installed stay.',
    recommended: false
  },
  startRecommendations: {
    title: 'Promotions in Start',
    text: 'Start’s Recommended section also shows tips, new apps and other promotions (Windows 11).',
    recommended: false
  },
  tips: {
    title: 'Tips and suggestions',
    text: 'Notifications with tips, the “Get even more out of Windows” screens and suggestions in Settings.',
    recommended: false
  },
  lockScreen: {
    title: 'Fun facts on the lock screen',
    text: 'Tips, facts and promotions shown over the lock screen picture.',
    recommended: false
  },
  location: {
    title: 'Apps can use your location',
    text: 'Maps, Weather and other apps can see where you are. Off: they can’t, and you type your city when an app needs it.',
    recommended: null
  },
  recall: {
    title: 'Recall snapshots',
    text: 'On Copilot+ PCs, Recall can save snapshots of your screen so you can search what you saw. It stays off until you turn it on; Blocked means it can’t be turned on.',
    recommended: null,
    onText: 'Allowed',
    offText: 'Blocked'
  }
}

export function PrivacyPage() {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [problem, setProblem] = useState(null)
  const [explorerPending, setExplorerPending] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSettings(await window.api.getPrivacySettings())
    } catch (err) {
      setSettings([])
      setError(errorText(err, 'Couldn’t read the privacy settings.'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const apply = async (changes, busyKey) => {
    if (changes.length === 0) return
    setBusy(busyKey)
    setProblem(null)
    const result = await window.api
      .setPrivacySettings(changes)
      .catch((err) => ({ ok: false, error: errorText(err) }))
    const failure = actionError(result)
    if (failure) setProblem(failure)
    if (changes.some((c) => settings.find((s) => s.id === c.id)?.explorer) && !failure)
      setExplorerPending(true)
    // Read back what Windows has now, also after a partial failure
    await load()
    setBusy(null)
  }

  const known = (settings ?? []).filter((s) => TEXT[s.id])
  const withAdvice = known.filter((s) => TEXT[s.id].recommended !== null)
  const toRecommend = withAdvice.filter((s) => s.on !== TEXT[s.id].recommended)
  const offNow = known.filter((s) => !s.on || s.partly)

  return (
    <Page
      title="Privacy"
      description="Decide what Windows shares and shows you. Every switch can be turned back on."
    >
      {error ? (
        <InfoBar severity="warning" title="Couldn’t read the privacy settings">
          {error}
        </InfoBar>
      ) : settings === null ? (
        <Card className="flex items-center gap-3 p-5 text-text-secondary">
          <ProgressRing /> Reading the privacy settings…
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-cyan text-brand-carbon">
              {toRecommend.length === 0 ? (
                <CheckmarkCircleFilled aria-hidden className="size-6" />
              ) : (
                <ShieldRegular aria-hidden className="size-6" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-brand text-[18px] leading-snug font-semibold">
                {toRecommend.length === 0
                  ? 'Your privacy settings match our recommendations.'
                  : `${toRecommend.length} of ${withAdvice.length} settings differ from our recommendations.`}
              </p>
              <p className="text-text-secondary">
                We recommend turning off what sends data you don’t need to share or shows ads.
                Location and Recall are up to you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="accent"
                icon={SparkleRegular}
                disabled={busy !== null || toRecommend.length === 0}
                onClick={() =>
                  apply(
                    toRecommend.map((s) => ({ id: s.id, on: TEXT[s.id].recommended })),
                    'all'
                  )
                }
              >
                Use recommended
              </Button>
              <Button
                icon={ArrowResetRegular}
                disabled={busy !== null || offNow.length === 0}
                onClick={() =>
                  apply(
                    offNow.map((s) => ({ id: s.id, on: true })),
                    'all'
                  )
                }
              >
                Restore Windows defaults
              </Button>
            </div>
          </Card>

          {busy === 'all' && (
            <p className="-mt-3 inline-flex items-center gap-2 text-text-secondary">
              <ProgressRing /> Applying… Windows may ask for permission.
            </p>
          )}
          {problem && (
            <InfoBar severity="warning" title="Some settings didn’t change" className="-mt-3">
              {problem}
            </InfoBar>
          )}
          {explorerPending && (
            <InfoBar
              severity="info"
              title="Start and search update after File Explorer restarts"
              className="-mt-3"
              action={
                <Button
                  icon={ArrowClockwiseRegular}
                  onClick={() => {
                    setExplorerPending(false)
                    void window.api.restartExplorer()
                  }}
                >
                  Restart File Explorer
                </Button>
              }
            >
              Your open windows stay open; the taskbar disappears for a moment.
            </InfoBar>
          )}

          {GROUPS.map((group) => {
            const items = known.filter((s) => s.group === group.id)
            if (items.length === 0) return null
            return (
              <section key={group.id}>
                <h2 className="mb-2 font-brand text-subtitle font-semibold">{group.title}</h2>
                <Card className="divide-y divide-card-stroke">
                  {items.map((setting) => {
                    const text = TEXT[setting.id]
                    return (
                      <div
                        key={setting.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {text.title}
                            {text.recommended === false && setting.on && (
                              <Badge tone="neutral">We suggest off</Badge>
                            )}
                            {setting.partly && <Badge tone="neutral">Partly off</Badge>}
                          </p>
                          <p className="text-text-secondary">{text.text}</p>
                          {setting.admin && (
                            <p className="mt-1 inline-flex items-center gap-1 text-caption text-text-secondary">
                              <ShieldRegular aria-hidden className="size-3.5" />
                              Asks for permission
                            </p>
                          )}
                        </div>
                        {busy === setting.id ? (
                          <ProgressRing label={`Changing ${text.title}`} />
                        ) : (
                          <ToggleSwitch
                            checked={setting.on}
                            disabled={busy !== null}
                            onChange={(on) => apply([{ id: setting.id, on }], setting.id)}
                            label={text.title}
                            onText={text.onText}
                            offText={text.offText}
                          />
                        )}
                      </div>
                    )
                  })}
                </Card>
              </section>
            )
          })}
          <p className="text-caption text-text-secondary">
            Based on the privacy tweaks in Chris Titus Tech’s WinUtil (MIT licence), limited to the
            ones that are safe and can be undone.
          </p>
        </div>
      )}
    </Page>
  )
}
