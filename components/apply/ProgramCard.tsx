import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PosterImage from '@/components/ui/PosterImage'
import { cardText, CARD_TEXT } from '@/lib/ui/programCardText'
import { groupNoticeOf } from '@/lib/forms'
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
  const { blurb, items } = cardText(program.description)
  // 두 모드 중 큰 개수만큼 그리고, 휴대폰 초과분은 CSS 로 숨긴다 (규칙은 CARD_TEXT 한 곳)
  const shown = items.slice(0, Math.max(CARD_TEXT.mobile.itemMax, CARD_TEXT.desktop.itemMax))

  return (
    <article
      className={
        // D-91: 한 DOM, 두 배치 — 이름 붙인 격자 영역(globals.css .program-card).
        //   휴대폰(md 미만)  [썸네일 | 배지·제목]  →  요약·항목·메타·버튼은 **전체 폭**
        //   PC(md 이상)      [포스터 | 배지·제목·요약·항목·메타·버튼]  (D-89 가로 분할 그대로)
        // 휴대폰에서 카드가 화면을 다 먹던 원인은 글이 아니라 240×320 포스터였다(포스터 없는
        // 카드는 한 화면에 들어왔음) → 썸네일 100px 로. 사방 같은 패딩(1rem · md 1.25rem)
        'card-raised-link program-card ' + (poster ? '' : 'program-card--noposter ') + (closed ? 'opacity-80' : '')
      }
    >
      {poster && (
        <Link
          href={href}
          className="group relative block w-full overflow-hidden rounded-[10px] bg-subtle [grid-area:thumb] md:self-center md:rounded-xl"
          aria-label={`${program.title} 포스터 — 자세히 보기`}
        >
          {/* D-86: next/image — 칸 폭에 맞는 WebP 만 받는다(휴대폰 100 · PC ≤240). lazy.
              PC 칸 최대폭 260→220(D-87)→240(D-89): 카드 높이 = 포스터 높이라 글이 들어오는 폭.
              목록에서 포스터는 읽는 대상이 아니라 **식별자** — 글자는 상세에서 읽는다(D-91) */}
          <PosterImage
            url={poster}
            alt=""
            sizes="(max-width: 819px) 100px, 240px"
            className="w-full"
          />
          {/* 올리면 살짝 어두워지며 힌트 — 휴대폰(터치)엔 없음 */}
          <span
            aria-hidden="true"
            className="absolute inset-0 hidden items-end justify-center bg-ink/0 pb-3 text-xs font-bold text-white opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100 md:flex"
          >
            자세히 보기
          </span>
        </Link>
      )}

      {/* 배지 줄 + 제목 — 휴대폰에선 썸네일 오른쪽, PC 에선 글 열 맨 위 */}
      <div className="min-w-0 [grid-area:head]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
          <Badge tone={isGroup ? 'group' : 'individual'}>
            {isGroup ? '단체 프로그램' : '개인 신청'}
          </Badge>
          {/* 테스트 계정에게만 보이는 비공개 공고 (D-111) — 학생에게는 이 카드 자체가 없다 */}
          {!program.published && <Badge tone="warn">비공개 · 시험</Badge>}
          {dday !== null && (
            <span className="text-[13px] font-bold text-warn-ink">
              {dday === 0 ? '오늘 마감' : `D-${dday}`}
            </span>
          )}
        </div>
        <h3 className="mt-2.5 line-clamp-2 break-keep text-lg font-bold leading-snug tracking-tight md:mt-3">
          <Link href={href} className="hover:text-brand-600">
            {program.title}
          </Link>
        </h3>
      </div>

      {/* 본문 — 휴대폰에선 전체 폭(썸네일 아래), PC 에선 글 열의 나머지. 버튼은 바닥(mt-auto) */}
      <div className="flex min-w-0 flex-col [grid-area:body]">
        {/* 소개 → 요약 2줄 + 항목(휴대폰 3개×2줄 · PC 3개×1줄). 규칙·스타일은
            lib/ui/programCardText 한 곳 — 담당자 미리보기와 공유(D-90) */}
        {blurb && (
          <p className={'md:mt-1.5 ' + CARD_TEXT.blurbBase + ' ' + CARD_TEXT.responsive.blurbClamp}>
            {blurb}
          </p>
        )}
        {shown.length > 0 && (
          <ul className={CARD_TEXT.listBase}>
            {shown.map((line, i) => (
              <li
                key={i}
                className={
                  CARD_TEXT.itemBase +
                  ' ' +
                  CARD_TEXT.responsive.itemClamp +
                  // 휴대폰 규칙 개수를 넘는 항목은 CSS 로 숨긴다(JS 폭 분기 금지 — 하이드레이션)
                  (i >= CARD_TEXT.mobile.itemMax ? ' ' + CARD_TEXT.responsive.itemOverflow : '')
                }
              >
                {line}
              </li>
            ))}
          </ul>
        )}

        {/* 메타 상자 — 기간·방식 (지시서 §4). 정원·혜택은 데이터가 없어 넣지 않는다 */}
        <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-lg bg-subtle px-3 py-2 text-sm md:grid-cols-2">
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
                ? `${groupNoticeOf(program).short}${
                    program.maxTeamSize ? ` · 최대 ${program.maxTeamSize}명` : ''
                  }`
                : '개인'}
            </dd>
          </div>
        </dl>

        {/* CTA — PC 는 카드 바닥 고정(mt-auto · D-87), 휴대폰은 전체 폭 */}
        <div className="mt-4 flex justify-end md:mt-auto md:pt-4">
          {closed ? (
            <Button variant="secondary" href={href} className="max-md:w-full">
              공고 보기
            </Button>
          ) : (
            <Button href={href} className="max-md:w-full">
              자세히 보고 신청하기 →
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
