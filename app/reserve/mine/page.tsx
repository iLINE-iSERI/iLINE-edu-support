'use client'

/**
 * 내 예약 — 조회·취소 (화면 설계 §2).
 *
 * 상태는 둘: 접수됨 → 확정됨. 취소는 이용일 전날까지 언제든(J-5 가정값).
 * 확정된 것을 취소하면 다음 목요일 명단의 「취소」 묶음으로 행정실에
 * 알린다(D-55) — 그 뜻을 취소 전에 적어 준다.
 */

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import MemberGate from '@/components/auth/MemberGate'
import EmptyState from '@/components/ui/EmptyState'
import ReservationCard from '@/components/reserve/ReservationCard'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  listMyReservations,
  getReservationSettings,
  canCancelMyself,
  cancelMyReservation,
} from '@/lib/firebase/reservations'
import { computeWindow, toYmd } from '@/lib/reservations/window'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Reservation } from '@/lib/types'

export default function MyReservationsPage() {
  return (
    <MemberGate>
      <Content />
    </MemberGate>
  )
}

function Content() {
  const { user } = useAuth()
  const [list, setList] = useState<Reservation[] | null>(null)
  const [deliverDate, setDeliverDate] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  /** 취소 확인 패널이 열린 예약 — window.confirm 대신 카드 안에서 확인한다 */
  const [confirming, setConfirming] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [mine, settings] = await Promise.all([
        listMyReservations(user.uid),
        getReservationSettings().catch(() => null),
      ])
      setList(mine)
      if (settings) setDeliverDate(computeWindow(settings).deliverDate)
    } catch (e) {
      console.error('[iLINE] 예약 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setList([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = async (r: Reservation) => {
    setBusy(r.id)
    setActionError('')
    try {
      await cancelMyReservation(r)
      setConfirming(null)
      await load()
    } catch (e) {
      console.error('[iLINE] 예약 취소 실패:', e)
      setActionError(actionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const today = toYmd(new Date())
  const upcoming = (list ?? []).filter((r) => r.status !== 'cancelled' && r.date >= today)
  const past = (list ?? []).filter((r) => r.status === 'cancelled' || r.date < today)

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {actionError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {actionError}
          </p>
        )}

        <section>
          <h2 className="section-title">다가오는 예약</h2>
          <div className="mt-4">
            {list === null ? (
              <p className="text-sm text-ink-muted">불러오는 중…</p>
            ) : error ? (
              <EmptyState title="예약 내역을 불러오지 못했습니다" desc={error} />
            ) : upcoming.length === 0 ? (
              <EmptyState
                title="아직 예약이 없습니다"
                action={
                  <Button href="/reserve">예약하기</Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {[...upcoming].reverse().map((r) => (
                  <li key={r.id}>
                    <ReservationCard
                      reservation={r}
                      deliverDate={deliverDate}
                      action={
                        !canCancelMyself(r) ? (
                          <p className="text-xs text-ink-subtle">
                            이용 당일에는 취소할 수 없습니다. 못 오시게 되었다면 담당자에게 알려 주세요.
                          </p>
                        ) : confirming === r.id ? (
                          <div className="w-full rounded-xl bg-subtle p-4 text-sm leading-relaxed">
                            <p>
                              {r.status === 'confirmed'
                                ? '이 예약은 이미 행정실에 전달되었습니다. 취소하시면 다음 전달 때 취소 사실도 함께 전달됩니다.'
                                : '이 예약을 취소합니다. 자리는 바로 다시 열립니다.'}
                            </p>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Button variant="secondary" disabled={busy === r.id} onClick={() => setConfirming(null)}>
                                돌아가기
                              </Button>
                              {/* 되돌리기 어려운 것 = danger (디자인 규칙 §4) */}
                              <Button variant="danger" disabled={busy === r.id} onClick={() => cancel(r)}>
                                {busy === r.id ? '취소 중…' : '예약 취소 확정'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="secondary" onClick={() => setConfirming(r.id)}>
                            예약 취소
                          </Button>
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="section-title text-ink-muted">
              지난 예약 · 취소한 예약
            </h2>
            <ul className="mt-4 space-y-3">
              {past.map((r) => (
                <li key={r.id}>
                  <ReservationCard reservation={r} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
