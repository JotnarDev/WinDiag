import { Page } from '@/components/Page'
import { Card } from '@/components/ui/Card'

/** A page of the home edition that isn't built yet: what it will do. */
export function comingSoonPage({ title, description, plans }) {
  function ComingSoon() {
    return (
      <Page title={title} description={description}>
        <Card className="p-5">
          <p className="font-semibold">Coming in a later version</p>
          <ul className="mt-2 list-disc pl-5 text-text-secondary">
            {plans.map((plan) => (
              <li key={plan}>{plan}</li>
            ))}
          </ul>
        </Card>
      </Page>
    )
  }
  ComingSoon.displayName = `ComingSoon(${title})`
  return ComingSoon
}
