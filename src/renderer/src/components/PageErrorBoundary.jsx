import { Component } from 'react'
import { ErrorCircleRegular } from '@fluentui/react-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/**
 * Keeps one broken page from blanking the whole window: shows what happened,
 * writes it to the error log and lets the person try again.
 */
export class PageErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    void window.api
      .logError(
        `The ${this.props.page} page stopped: ${error?.message ?? error}`,
        `${error?.stack ?? ''}\n${info?.componentStack ?? ''}`
      )
      .catch(() => {})
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto w-full max-w-[1000px] px-5 pt-8 sm:px-10">
        <Card className="flex flex-col items-start gap-3 p-6">
          <ErrorCircleRegular aria-hidden className="size-8 text-critical" />
          <h1 className="font-brand text-[24px] font-semibold">This page stopped working</h1>
          <p className="text-text-secondary">
            The error was saved to the error log (Settings &gt; Troubleshooting). The rest of
            WinDiag still works.
          </p>
          <p className="selectable rounded-control bg-subtle-hover px-3 py-2 font-mono text-caption">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <Button variant="accent" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }
}
