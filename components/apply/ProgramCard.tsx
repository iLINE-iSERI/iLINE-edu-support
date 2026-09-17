import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  getProgramPhase,
  PHASE_LABEL,
  daysUntilClose,
  formatPeriod,
} from '@/lib/firebase/programs'
import type { Program } from '@/lib/types'

/**
 * 프로그램 목록 카드 — 가로 분할 와이드 카드 (D-81 · 09-18 · Gemini 지시서 §4).
 *
 * 포스터가 있으면 왼쪽 30% 에 3:4 칸(object-contain — 포스터 글자가 안 잘린다),
 * 오른쪽에 배지·제목·한 줄 설명·메타 상자·[자세히 보고 신청하기]. 포스터가 없으면
 * 왼쪽 칸을 비워 두지 않고 글자 카드가 폭을 다 쓴다.
 * 카드 전체를 링크로 만들지 않는다 — 안에 버튼(링크)이 있어 링크 속 링크가 되므로.
 * 제목과 포스터, 버튼이 각각 상세로 간다. 올리면 카드가 살짝 떠오른다(.card-link).
 */
export default function ProgramCard({ program }: { program: Program }) {
  const phase = getProgramPhase(program)
  const dday = phase === 'open' ? daysUntilClose(program) : null
  const isGroup = program.participationType === 'group'
  const href = `/apply/${program.id}`
  const poster = program.poster?.url
  const closed = phase === 'closed'

  return (
    <article
      className={
        'card-link flex flex-col overflow-hidden sm:flex-row ' + (closed ? 'opacity-80' : '')
      }
    >
      {poster && (
        <Link
          href={href}
          className="group relative block shrink-0 bg-subtle sm:w-[30%] sm:max-w-[260px]"
          aria-label={`${program.title} 포스터 — 자세히 보기`}
        >
          <img
            src={poster}
            alt=""
            className="mx-auto aspect-[3/4] w-full max-w-[240px] object-contain sm:max-w-none"
            loading="lazy"
          />
          {/* 올리면 살짝 어두워지며 힌트 */}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-end justify-center bg-ink/0 pb-3 text-xs font-bold text-white opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100"
          >
            자세히 보기
          </span>
        </Link>
      )}

      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
          <Badge tone={isGroup ? 'group' : 'individual'}>
            {isGroup ? '단체 프로그램' : '개인 신청'}
          </Badge>
          {dday !== null && (
            <span className="text-[13px] font-bold text-warn-ink">
              {dday === 0 ? '오늘 마감' : `D-${dday}`}
            </span>
          )}
        </div>

        <h3 className="mt-3 line-clamp-2 break-keep text-lg font-bold leading-snug tracking-tight">
          <Link href={href} className="hover:text-brand-600">
            {program.title}
          </Link>
        </h3>

        {program.description && (
          <p className="mt-1.5 line-clamp-2 break-keep text-sm leading-relaxed text-ink-muted">
            {program.description}
          </p>
        )}

        {/* 메타 상자 — 기간·방식 (지시서 §4). 정원·혜택은 데이터가 없어 넣지 않는다 */}
        <dl className="mt-4 grid gap-x-6 gap-y-1.5 rounded-lg bg-subtle p-3 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-subtle">접수</dt>
            <dd className="font-medium">{formatPeriod(program.opensAt, program.closesAt)}</dd>
          </div>
          {(program.activityStart || program.activityEnd) && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-subtle">활동</dt>
              <dd className="font-medium">
                {formatPeriod(program.activityStart, program.activityEnd)}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-subtle">신청</dt>
            <dd className="font-medium">
              {isGroup
                ? `팀 단위${program.maxTeamSize ? ` · 최대 ${program.maxTeamSize}명` : ''}`
                : '개인'}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-end sm:mt-auto sm:pt-5">
          {closed ? (
            <Button variant="secondary" href={href} className="max-sm:w-full">
              공고 보기
            </Button>
          ) : (
            <Button href={href} className="max-sm:w-full">
              자세히 보고 신청하기 →
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
