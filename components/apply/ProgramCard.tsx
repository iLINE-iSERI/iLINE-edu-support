import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PosterImage from '@/components/ui/PosterImage'
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
/**
 * 목록 카드에 보일 한 토막 — 소개 본문의 **첫 문단**만 (D-87 · 09-18).
 *
 * 담당자가 문단과 이모지 항목(👥 대상 · 📊 활동 · 💰 지원)으로 구조를 잡아 쓴 글이
 * 목록에서는 줄바꿈이 사라진 채 한 덩어리로 붙어 이모지가 문장 중간에 박혔다.
 * **목록은 훑고 고르는 화면, 상세는 읽는 화면** — 목록에서 본문 줄바꿈을 살리면 담당자가
 * 쓴 원문 구조가 카드 높이를 좌우해 목록이 들쭉날쭉해진다. 그래서 빈 줄 기준 첫 문단만
 * 취하고, 문단 안의 한 줄 바꿈은 공백으로 펴서 2줄로 자른다. 첫 문단이 짧아도 뒤 문단을
 * 끌어오지 않는다(끌어오는 순간 이모지 항목이 딸려 온다). 상세·홈 카드는 그대로.
 */
export function firstParagraph(text?: string): string {
  if (!text) return ''
  const first = text.trim().split(/\n\s*\n/)[0] ?? ''
  return first.replace(/\s*\n\s*/g, ' ').trim()
}

export default function ProgramCard({ program }: { program: Program }) {
  const phase = getProgramPhase(program)
  const dday = phase === 'open' ? daysUntilClose(program) : null
  const isGroup = program.participationType === 'group'
  const href = `/apply/${program.id}`
  const poster = program.poster?.url
  const closed = phase === 'closed'
  const blurb = firstParagraph(program.description)

  return (
    <article
      className={
        'card-link flex flex-col overflow-hidden sm:flex-row ' + (closed ? 'opacity-80' : '')
      }
    >
      {poster && (
        <Link
          href={href}
          className="group relative block shrink-0 bg-subtle sm:w-[30%] sm:max-w-[220px]"
          aria-label={`${program.title} 포스터 — 자세히 보기`}
        >
          {/* D-86: next/image — 칸 폭(휴대폰 240 · PC 30%≤220)에 맞는 WebP 만 받는다.
              칸 최대폭 260→220 (D-87 · iSERI 선택): 카드 높이를 포스터가 정하므로 칸을 줄여야
              메타 상자와 버튼 사이 빈 곳(60px)이 실제로 준다. 목록의 포스터는 알아보는 용도.
              priority 없음 = lazy 그대로. 배경 자리는 PosterImage 가 그린다 */}
          <PosterImage
            url={poster}
            alt=""
            sizes="(max-width: 640px) 240px, 220px"
            className="mx-auto w-full max-w-[240px] sm:max-w-none"
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

        {blurb && (
          <p className="mt-1.5 line-clamp-2 break-keep text-sm leading-[1.65] text-ink-muted">
            {blurb}
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

        {/* CTA — 카드 바닥 고정(mt-auto). 카드 높이는 왼쪽 포스터(3:4)가 정하므로 글이
            짧으면 메타 상자와 버튼 사이가 비는데, 그 빈 곳이 버튼 위로 가게 두는 쪽이
            버튼이 중간에 뜨는 것보다 낫다 (D-87). 최소 간격 1.25rem */}
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
