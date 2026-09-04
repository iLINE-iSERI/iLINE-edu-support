import type { ReactNode } from 'react'

export type BadgeTone =
  | 'open'
  | 'upcoming'
  | 'closed'
  | 'group'
  | 'individual'
  | 'neutral'

const TONE: Record<BadgeTone, string> = {
  open: 'bg-status-approved/12 text-status-approved',
  upcoming: 'bg-status-submitted/12 text-status-submitted',
  closed: 'bg-subtle text-ink-subtle',
  group: 'bg-status-revision/12 text-status-revision',
  individual: 'bg-brand-soft text-brand-600 dark:text-brand-300',
  neutral: 'bg-subtle text-ink-muted',
}

export default function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ' +
        TONE[tone]
      }
    >
      {children}
    </span>
  )
}
