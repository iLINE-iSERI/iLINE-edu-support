'use client'

/**
 * 홈 첫 화면 — **지금 접수 중인 프로그램** (D-72 · 09-15).
 *
 * 교수님(09-14): 메인이 어렵다, 접수 중인 프로그램이 강조되게, 여러 개면 나열되게.
 * iSERI(09-15): **접수 중인 것만** 올린다(활동 중·예정은 목록에서). 최대 3개.
 *
 * 개수에 따라 자리를 다르게 쓴다 — 빈 칸이 생기지 않게.
 *   1개  카드 하나가 가로로 넓게 (제목 크게, 버튼은 오른쪽)
 *   2개  두 칸
 *   3개  세 칸 · 4개 이상이면 3개까지 + 「전체 프로그램 보기」
 *   0개  "지금 접수 중인 프로그램이 없습니다" + [지난 프로그램 보기] 하나
 * 휴대폰은 몇 개든 세로로 쌓인다. (휴대폰에서도 개수를 제한할지는 고민거리 — 남은 일)
 *
 * 사업명은 여기 두지 않는다 — 헤더에 이미 있다 (iSERI 09-15).
 * 목록 화면(/apply)과 같은 함수(listPublishedPrograms · getProgramPhase)를 써서
 * 두 화면이 어긋나지 않는다. 옛 CurrentProgramCard(1건) 를 대체한다.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import {
  listPublishedPrograms,
  getProgramPhase,
  daysUntilClose,
  formatPeriodShort,
} from '@/lib/firebase/programs'
import type { Program } from '@/lib/types'

/** 홈에 올리는 최대 개수 — 넘치면 목록으로 */
const MAX = 3

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ok'; open: Program[]; more: boolean }

export default function OpenPrograms() {
  const [state, setState] = useState<State>({ kind: 'loading' })

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

  const n = state.kind === 'ok' ? state.open.length : 0

  return (
    <section
      className="bg-brand-600 text-white dark:bg-brand-900"
      aria-labelledby="home-open-title"
      aria-busy={state.kind === 'loading'}
    >
      <div className="container-page py-9 sm:py-12">
        <SectionTitle
          id="home-open-title"
          invert
          aside={
            <Link href="/apply" className="hover:underline underline-offset-4">
              전체 프로그램 보기 →
            </Link>
          }
        >
          {state.kind === 'ok' && n === 0
            ? '지금 접수 중인 프로그램이 없습니다'
            : '지금 접수 중인 프로그램'}
        </SectionTitle>

        <div
          className={
            'mt-4 grid gap-3.5 sm:mt-5 ' +
            (n === 2 ? 'md:grid-cols-2' : n >= 3 ? 'md:grid-cols-3' : '')
          }
        >
          {state.kind === 'loading' && (
            <div className="rounded-2xl bg-surface/90 p-6 text-sm text-ink-muted">
              공고를 확인하는 중…
            </div>
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
            state.open.map((p) => <ProgramHeroCard key={p.id} program={p} wide={n === 1} />)}
        </div>

        {state.kind === 'ok' && state.more && (
          <p className="mt-4 text-sm text-white/80">
            접수 중인 프로그램이 더 있습니다 —{' '}
            <Link href="/apply" className="font-semibold text-white underline underline-offset-4">
              전체 프로그램 보기
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}

function EmptyCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 text-ink shadow-[0_10px_30px_rgba(0,0,0,0.18)] md:flex-row md:items-center md:justify-between md:px-8">
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{desc}</p>
      </div>
      <Button variant="secondary" href="/apply" className="md:shrink-0">
        지난 프로그램 보기
      </Button>
    </div>
  )
}

function ProgramHeroCard({ program: p, wide }: { program: Program; wide: boolean }) {
  const dday = daysUntilClose(p)
  const isGroup = p.participationType === 'group'

  return (
    <article
      className={
        'flex flex-col rounded-2xl bg-surface p-5 text-ink shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-6 ' +
        (wide ? 'md:flex-row md:items-center md:justify-between md:gap-6 md:px-8 md:py-7' : '')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
          <span className="rounded-full bg-status-submitted px-2.5 py-1 text-white">접수 중</span>
          {dday !== null && (
            <span className="text-status-revision">
              {dday === 0 ? '오늘 마감' : `마감까지 ${dday}일`}
            </span>
          )}
        </div>
        <h3
          className={
            'mt-3 break-keep font-extrabold leading-snug tracking-tight ' +
            (wide ? 'text-2xl sm:text-3xl' : 'text-[22px]')
          }
        >
          <Link href={`/apply/${p.id}`} className="hover:underline underline-offset-4">
            {p.title}
          </Link>
        </h3>
        <p className="mt-2.5 break-keep text-[14.5px] leading-relaxed text-ink-muted">
          <b className="font-semibold text-ink">접수</b> {formatPeriodShort(p.opensAt, p.closesAt)}
          {' · '}
          <b className="font-semibold text-ink">신청</b> {isGroup ? '팀 단위' : '개인'}
          {(p.activityStart || p.activityEnd) && (
            <>
              {' · '}
              <b className="font-semibold text-ink">활동</b>{' '}
              {formatPeriodShort(p.activityStart, p.activityEnd)}
            </>
          )}
        </p>
      </div>

      <div
        className={
          'mt-4 flex flex-wrap gap-2.5 ' + (wide ? 'md:mt-0 md:shrink-0' : '')
        }
      >
        <Button href={`/apply/${p.id}`} className="max-sm:w-full">
          신청하기 →
        </Button>
        <Button variant="secondary" href={`/apply/${p.id}`} className="max-sm:w-full">
          공고 보기
        </Button>
      </div>
    </article>
  )
}
