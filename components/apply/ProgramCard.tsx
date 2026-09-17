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
 * 목록 카드에 보일 글 — 요약 2줄 + 항목 최대 3줄 (D-87 → D-88 → D-89 · 09-18).
 *
 * D-87 은 "이모지가 문장 중간에 박힌다" 를 보고 첫 문단만 남겼는데, 그러자 「💰 지원: 팀당
 * 최대 50만 원…」처럼 **지원을 결심시키는 줄**이 목록에서 사라졌다. 문제는 이모지가 아니라
 * **줄 구조가 지워진 것**이었다 — 줄 앞머리의 이모지는 훑기를 돕는 불릿이다. 줄 수에 상한을
 * 두면 줄바꿈을 살려도 카드 높이는 통제된다.
 *
 * D-89 2단 판별 — D-88 은 "첫 문단 뒤의 패턴 줄"만 항목으로 봐서, **빈 줄 없이 엔터로만 6줄**
 * 쓴 공고는 통째로 한 문단이 되어 한 줄로 뭉개졌다. 담당자가 줄을 나눈 것 자체가 "항목" 이라는
 * 뜻이다.
 *   요약  빈 줄이 있으면 첫 문단(안의 줄바꿈은 공백 — 두 줄로 감싼 요약을 반 토막 내지 않게),
 *         빈 줄이 없으면 첫 줄 · 2줄 클램프
 *   항목  나머지 줄 중 (가) 패턴 줄(이모지·불릿·앞 12자 안 콜론)이 하나라도 있으면 패턴 줄만,
 *         (나) 하나도 없으면 남은 줄을 순서대로 · 최대 3개 · 각 1줄 클램프
 *   (가)(나) 를 섞지 않는다 — 「요약 → 줄글 문단 → 이모지 항목」 구조에서 줄글이 자리를
 *   차지해 뒤 이모지 항목이 밀리면 안 된다. 4개 이상이면 앞 3개("외 N개" 없음).
 *
 * 휴리스틱이다 — 근본 해법은 `highlights` 필드(백로그). 원문은 가공하지 않는다(이모지 유지).
 * 상세·홈 카드는 그대로.
 */
const ITEM_MAX = 3
const ITEM_RE = [
  // (a) 이모지로 시작 — tsconfig target 이 es5 라 리터럴 /…/u 가 안 통해 생성자로(브라우저는 다 됨)
  new RegExp('^\\s*\\p{Extended_Pictographic}', 'u'),
  /^\s*[-•·※▪◦*]/, // (b) 불릿 기호
  /^.{0,12}:/, // (c) 앞 12자 안에 콜론 — "대상: …"
]
const isPattern = (line: string) => ITEM_RE.some((re) => re.test(line))

/** 요약 한 토막과 항목 줄들 */
export function cardText(text?: string): { blurb: string; items: string[] } {
  const src = (text ?? '').trim()
  if (!src) return { blurb: '', items: [] }
  const paras = src.split(/\n\s*\n/)
  let blurb: string
  let restLines: string[]
  if (paras.length > 1) {
    blurb = paras[0].replace(/\s*\n\s*/g, ' ').trim()
    restLines = paras.slice(1).join('\n').split('\n')
  } else {
    const lines = src.split('\n')
    blurb = (lines[0] ?? '').trim()
    restLines = lines.slice(1)
  }
  const rest = restLines.map((l) => l.trim()).filter(Boolean)
  const patterned = rest.filter(isPattern)
  const items = (patterned.length > 0 ? patterned : rest).slice(0, ITEM_MAX)
  return { blurb, items }
}


export default function ProgramCard({ program }: { program: Program }) {
  const phase = getProgramPhase(program)
  const dday = phase === 'open' ? daysUntilClose(program) : null
  const isGroup = program.participationType === 'group'
  const href = `/apply/${program.id}`
  const poster = program.poster?.url
  const closed = phase === 'closed'
  const { blurb, items } = cardText(program.description)

  return (
    <article
      className={
        // D-89: 사방 같은 패딩(1rem · sm 1.25rem) 안에 포스터와 글이 같이 들어간다 — 포스터가
        // 모서리에 붙어 카드 16px 모서리를 뚫고 나오고 배지 줄과 8px 어긋나던 것. 포스터↔글 1.25rem
        'card-link flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5 ' + (closed ? 'opacity-80' : '')
      }
    >
      {poster && (
        <Link
          href={href}
          className="group relative block shrink-0 overflow-hidden rounded-xl bg-subtle sm:w-[30%] sm:max-w-[240px] sm:self-center"
          aria-label={`${program.title} 포스터 — 자세히 보기`}
        >
          {/* D-86: next/image — 칸 폭에 맞는 WebP 만 받는다. priority 없음 = lazy.
              칸 최대폭 260→220(D-87 B안)→240(D-89 A-3 3순위): 카드 높이 = 포스터 높이인데
              요약 2줄 + 항목 3줄 + 메타 + 버튼이 220 의 293px 보다 길어 240(320px) 으로.
              모서리 12px(rounded-xl) — 카드 16px 보다 한 단계 작게. 배경 자리는 PosterImage */}
          <PosterImage
            url={poster}
            alt=""
            sizes="(max-width: 640px) 240px, 240px"
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

      <div className="flex min-w-0 flex-1 flex-col">
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
        {items.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-sm leading-[1.6] text-ink-muted">
            {items.map((line, i) => (
              <li key={i} className="line-clamp-1 break-keep">
                {line}
              </li>
            ))}
          </ul>
        )}

        {/* 메타 상자 — 기간·방식 (지시서 §4). 정원·혜택은 데이터가 없어 넣지 않는다 */}
        <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-lg bg-subtle px-3 py-2 text-sm sm:grid-cols-2">
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
        <div className="mt-4 flex justify-end sm:mt-auto sm:pt-4">
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
