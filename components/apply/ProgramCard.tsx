import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import {
  getProgramPhase,
  PHASE_LABEL,
  daysUntilClose,
  formatPeriod,
} from '@/lib/firebase/programs'
import type { Program } from '@/lib/types'

export default function ProgramCard({ program }: { program: Program }) {
  const phase = getProgramPhase(program)
  const dday = phase === 'open' ? daysUntilClose(program) : null
  const isGroup = program.participationType === 'group'

  return (
    <Link
      href={`/apply/${program.id}`}
      className="group block rounded-2xl border border-line bg-surface p-5 transition hover:border-line-strong hover:shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
        <Badge tone={isGroup ? 'group' : 'individual'}>
          {isGroup ? '단체 프로그램' : '개인 신청'}
        </Badge>
        {dday !== null && (
          <span className="text-xs font-semibold text-ink-subtle">
            {dday === 0 ? '오늘 마감' : `D-${dday}`}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-lg font-bold leading-snug">
        {program.title}
        <span
          aria-hidden="true"
          className="ml-1.5 inline-block transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </h3>

      {program.description && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
          {program.description}
        </p>
      )}

      <p className="mt-3 text-sm text-ink-subtle">
        접수 {formatPeriod(program.opensAt, program.closesAt)}
      </p>

      {isGroup && program.maxTeamSize && (
        <p className="mt-1 text-xs text-ink-subtle">
          팀 구성 최대 {program.maxTeamSize}명 (대표자 포함)
        </p>
      )}
    </Link>
  )
}
