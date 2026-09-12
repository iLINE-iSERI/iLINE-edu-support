'use client'

/**
 * 홈 화면 맨 위 — **지금 신청할 수 있는 공고** 한 장 (09-12).
 *
 * ⚠️ 09-12까지 이 자리에 **"접수중 · D-14 · 2026. 9. 1. ~ 9. 18."이 글자로
 *    박혀 있었다.** 예시 값이었는데 어디에도 기록되지 않아, 그대로 열었다면
 *    첫 화면이 거짓 접수 기간을 보여줄 뻔했다. 지금은 프로그램 목록에서
 *    **접수중 → 접수 예정** 순으로 하나를 골라 보여주고, 없으면 그렇게 말한다.
 *
 * 목록 화면(/apply)과 같은 함수(listPublishedPrograms · getProgramPhase)를 써서
 * 두 화면이 어긋나지 않는다.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  listPublishedPrograms,
  getProgramPhase,
  daysUntilClose,
  formatPeriod,
  PHASE_LABEL,
} from '@/lib/firebase/programs'
import type { Program } from '@/lib/types'

type State =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'ok'; program: Program }

export default function CurrentProgramCard() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    listPublishedPrograms()
      .then((list) => {
        if (!alive) return
        // 정렬이 이미 접수중 → 예정 → 마감 순이라 첫 번째가 답이다.
        // 마감된 것만 남았으면 "지금 신청할 수 있는 공고 없음"으로.
        const top = list.find((p) => getProgramPhase(p) !== 'closed')
        setState(top ? { kind: 'ok', program: top } : { kind: 'none' })
      })
      .catch((e) => {
        console.warn('[iLINE] 홈 공고 조회 실패:', e)
        if (alive) setState({ kind: 'error' })
      })
    return () => {
      alive = false
    }
  }, [])

  const box = 'mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6'

  if (state.kind === 'loading') {
    return (
      <div className={box} aria-busy="true">
        <p className="text-sm text-ink-muted">공고를 확인하는 중…</p>
      </div>
    )
  }

  if (state.kind !== 'ok') {
    return (
      <div className={box}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold">지금 접수 중인 공고가 없습니다</p>
            <p className="mt-1 text-sm text-ink-muted">
              새 공고는 알림마당 공지사항과 프로그램 신청 화면에 올라옵니다.
            </p>
          </div>
          <Link
            href="/apply"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-6 text-base font-bold hover:bg-subtle sm:shrink-0"
          >
            프로그램 보기
          </Link>
        </div>
      </div>
    )
  }

  const p = state.program
  const phase = getProgramPhase(p)
  const dday = phase === 'open' ? daysUntilClose(p) : null

  return (
    <div className={box}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={
                'rounded-full px-2.5 py-1 text-xs font-bold ' +
                (phase === 'open'
                  ? 'bg-status-approved/10 text-status-approved'
                  : 'bg-status-submitted/12 text-status-submitted')
              }
            >
              {PHASE_LABEL[phase]}
            </span>
            {dday !== null && (
              <span className="text-xs text-ink-subtle">
                {dday === 0 ? '오늘 마감' : `D-${dday}`}
              </span>
            )}
          </div>
          <p className="mt-2 text-lg font-bold">{p.title}</p>
          <p className="mt-1 text-sm text-ink-muted">
            접수기간 {formatPeriod(p.opensAt, p.closesAt)}
          </p>
        </div>
        <Link
          href={`/apply/${p.id}`}
          className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 text-base font-bold text-white hover:bg-brand-700 sm:shrink-0"
        >
          {phase === 'open' ? '신청하기' : '공고 보기'}
        </Link>
      </div>
    </div>
  )
}
