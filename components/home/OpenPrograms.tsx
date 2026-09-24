'use client'

/**
 * 홈 첫 화면 — 왼쪽 사업 소개 + 오른쪽 **지금 접수 중인 프로그램** (D-81 · 09-18 재구성).
 *
 * 교수님(09-14): 메인이 어렵다, 접수 중인 프로그램이 강조되게, 여러 개면 나열되게.
 * iSERI(09-15): **접수 중인 것만** 올린다(활동 중·예정은 목록에서). 최대 3개.
 * 09-18 (Gemini 지시서 §3): 남색 밴드를 걷고 **6:4 분할** — 왼쪽에 알약 배지·제목·
 * 한 줄 설명·버튼 둘, 오른쪽에 접수 카드. 바탕은 파랑+청록 워시(.hero-wash · D-82, 6.2%/5%).
 *
 * 오른쪽은 개수에 따라 자리를 다르게 쓴다 — 빈 칸이 생기지 않게.
 *   1개  카드 하나가 칸을 채움 (제목 크게, 버튼 둘)
 *   2개  두 장 나란히, 버튼 줄 맞춤 (휴대폰은 세로)
 *   3개  세 장 세로로 촘촘히 · 4개 이상이면 3개 + 「전체 프로그램 보기」
 *   0개  "지금 접수 중인 프로그램이 없습니다" + [지난 프로그램 보기]
 * 포스터는 홈 카드에 **넣지 않는다** (iSERI 09-18 두 번째 지시서: 좁은 칸에서 글자가
 * 뭉개지고 카드마다 모양이 달라진다 → 글자 카드로 통일). 포스터는 목록·상세에서.
 *
 * 목록 화면(/apply)과 같은 함수(listPublishedPrograms · getProgramPhase)를 써서
 * 두 화면이 어긋나지 않는다.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { groupNoticeOf } from '@/lib/forms'
import {
  listPublishedPrograms,
  getProgramPhase,
  daysUntilClose,
  formatPeriodShort,
} from '@/lib/firebase/programs'
import type { Program } from '@/lib/types'
import { SITE } from '@/lib/config/site'

/** 홈에 올리는 최대 개수 — 넘치면 목록으로 */
const MAX = 3

export type HeroState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ok'; open: Program[]; more: boolean }

export default function OpenPrograms() {
  const [state, setState] = useState<HeroState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    listPublishedPrograms()
      .then((list) => {
        if (!alive) return
        const open = list.filter((p) => getProgramPhase(p) === 'open')
        setState({ kind: 'ok', open: open.slice(0, MAX), more: open.length > MAX })
      })
      .catch((e) => {
        console.warn('[iLINE] 홈 공고 조회 실패:', e)
        if (alive) setState({ kind: 'error' })
      })
    return () => {
      alive = false
    }
  }, [])

  return <HeroView state={state} />
}

/** 그리기만 — 조회는 위에서. 시안 확인용으로 따로 내보낸다 */
export function HeroView({ state }: { state: HeroState }) {
  const n = state.kind === 'ok' ? state.open.length : 0

  return (
    <section
      className="hero-wash relative overflow-hidden border-b border-line"
      aria-labelledby="home-hero-title"
      aria-busy={state.kind === 'loading'}
    >
      <div className="container-page relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-14 lg:py-20">
        {/* 왼쪽 — 사업 한 줄 + 버튼 둘 */}
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-ink">
            {SITE.funder} · {SITE.university}
          </span>
          <h1
            id="home-hero-title"
            className="mt-5 break-keep text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-5xl"
          >
            AI 시대의 교실을 준비하는
            <br />
            예비교원을 지원합니다
          </h1>
          <p className="mt-4 max-w-xl break-keep text-base leading-relaxed text-ink-muted sm:text-lg">
            {SITE.programName} 참여 사이트입니다. 프로그램 신청과 여비 정산, 산출물 제출,
            공부실 예약을 이곳에서 합니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/apply" className="max-sm:w-full">
              프로그램 보기 →
            </Button>
            <Button variant="secondary" href="/about" className="max-sm:w-full">
              사업 소개
            </Button>
          </div>
        </div>

        {/* 오른쪽 — 접수 중인 프로그램. 휴대폰에서는 **먼저** 보인다(교수님 09-14: 접수 중인
            프로그램이 주인공) — 소개 글은 그 아래로. PC 는 6:4 로 나란히 */}
        <div className="relative order-first min-w-0 lg:order-none">
          <div className="relative">
            <p className="mb-3 flex items-center justify-between text-sm font-bold text-ink">
              <span>
                {state.kind === 'ok' && n === 0
                  ? '지금 접수 중인 프로그램이 없습니다'
                  : '지금 접수 중인 프로그램'}
              </span>
              <Link
                href="/apply"
                className="font-semibold text-brand-600 hover:underline underline-offset-4"
              >
                전체 보기 →
              </Link>
            </p>

            <div className={'grid gap-3.5 ' + (n === 2 ? 'sm:grid-cols-2' : '')}>
              {state.kind === 'loading' && (
                <div className="card p-6 text-sm text-ink-muted">공고를 확인하는 중…</div>
              )}

              {state.kind === 'error' && (
                <EmptyCard
                  title="공고를 불러오지 못했습니다"
                  desc="잠시 뒤 다시 열어 주세요. 계속 그러면 문의처로 알려 주세요."
                />
              )}

              {state.kind === 'ok' && n === 0 && (
                <EmptyCard
                  title="새 공고는 이 자리와 알림마당 공지사항에 올라옵니다."
                  desc="회원가입을 해 두시면 공고가 열릴 때 바로 신청하실 수 있습니다."
                />
              )}

              {state.kind === 'ok' &&
                state.open.map((p) => (
                  <ProgramHeroCard
                    key={p.id}
                    program={p}
                    size={n === 1 ? 'wide' : n === 2 ? 'tall' : 'compact'}
                  />
                ))}
            </div>

            {state.kind === 'ok' && state.more && (
              <p className="mt-3 text-sm text-ink-muted">
                접수 중인 프로그램이 더 있습니다 —{' '}
                <Link
                  href="/apply"
                  className="font-semibold text-brand-600 underline underline-offset-4"
                >
                  전체 프로그램 보기
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function EmptyCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{desc}</p>
      </div>
      <Button variant="secondary" href="/apply" className="self-start">
        지난 프로그램 보기
      </Button>
    </div>
  )
}

/**
 * 접수 카드 세 가지 크기.
 *   wide     1개 — 큰 제목, 버튼 둘
 *   tall     2개 — 세로 카드, 버튼은 맨 아래 줄 맞춤(mt-auto)
 *   compact  3개 — 한 줄에 배지·제목·기간, 버튼 하나
 */
function ProgramHeroCard({
  program: p,
  size,
}: {
  program: Program
  size: 'wide' | 'tall' | 'compact'
}) {
  const dday = daysUntilClose(p)
  const isGroup = p.participationType === 'group'

  const meta = (
    <p className="mt-2 break-keep text-sm leading-relaxed text-ink-muted">
      <b className="font-semibold text-ink">접수</b> {formatPeriodShort(p.opensAt, p.closesAt)}
      {' · '}
      <b className="font-semibold text-ink">신청</b>{' '}
      {isGroup ? groupNoticeOf(p).short : '개인'}
      {size !== 'compact' && (p.activityStart || p.activityEnd) && (
        <>
          {' · '}
          <b className="font-semibold text-ink">활동</b>{' '}
          {formatPeriodShort(p.activityStart, p.activityEnd)}
        </>
      )}
    </p>
  )

  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="open">접수중</Badge>
      {dday !== null && (
        <span className="text-[13px] font-bold text-warn-ink">
          {dday === 0 ? '오늘 마감' : `D-${dday}`}
        </span>
      )}
    </div>
  )

  const titleCls =
    'mt-2.5 break-keep font-extrabold leading-snug tracking-tight ' +
    (size === 'wide' ? 'text-xl sm:text-2xl' : size === 'tall' ? 'text-lg' : 'text-base')

  const title = (
    <h3 className={titleCls}>
      <Link href={`/apply/${p.id}`} className="hover:text-brand-600">
        {p.title}
      </Link>
    </h3>
  )

  if (size === 'tall') {
    return (
      <article className="card flex flex-col p-5">
        {head}
        {title}
        {meta}
        <div className="mt-auto pt-5">
          <Button href={`/apply/${p.id}`} full>
            신청하기 →
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className={'card flex ' + (size === 'wide' ? 'p-5 sm:p-6' : 'p-5')}>
      <div className="flex min-w-0 flex-1 flex-col">
        {head}
        {title}
        {meta}
        <div className={'flex flex-wrap gap-2.5 ' + (size === 'wide' ? 'mt-5' : 'mt-3')}>
          <Button href={`/apply/${p.id}`} className="max-sm:w-full">
            신청하기 →
          </Button>
          {size === 'wide' && (
            <Button variant="secondary" href={`/apply/${p.id}`} className="max-sm:w-full">
              공고 보기
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
