'use client'

/**
 * 예약 현황 (화면 설계 §4) — 「오늘」이 기본이고, 날짜를 옮겨 본다.
 *
 * 현장 관리(지금 어느 자리에 누가 있나)와 대관 문의 확인(그 시간 비었나)에
 * 쓴다. 설계는 주간 격자를 그렸지만, 담당자에게 실제로 필요한 것은
 * "그 날 누가 언제 어디"이므로 **날짜 하나씩 목록**으로 보여준다 —
 * 회원 격자와 달리 이름이 들어가 칸에 안 들어간다. 주간은 요일 탭에
 * 건수만 보인다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MemberGate from '@/components/auth/MemberGate'
import EmptyState from '@/components/ui/EmptyState'
import {
  listReservationsOn,
  staffCancelReservation,
} from '@/lib/firebase/reservationsStaff'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import { VENUES, venueLabel, seatLabel, hourLabel } from '@/lib/config/venues'
import { toYmd, addDays, mondayOf, fromYmd, weekdayKo, shortDate, longDate } from '@/lib/reservations/window'
import { RESERVATION_STATUS_LABEL, type Reservation } from '@/lib/types'

export default function BoardPage() {
  return (
    <MemberGate requireStaff>
      <Content />
    </MemberGate>
  )
}

function Content() {
  const todayYmd = toYmd(new Date())
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [day, setDay] = useState(todayYmd)
  const [list, setList] = useState<Reservation[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState('')

  // 주말도 보여준다 — 담당자가 직접 넣은 주말 대관을 확인해야 하므로
  const days = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => toYmd(addDays(monday, i))), [monday])

  const load = useCallback(async () => {
    try {
      setList(await listReservationsOn(days))
      setError('')
    } catch (e) {
      console.error('[iLINE] 예약 현황 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setList([])
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const moveWeek = (n: number) => {
    const m = addDays(monday, n * 7)
    setMonday(m)
    setDay(toYmd(m))
  }
  const goToday = () => {
    setMonday(mondayOf(new Date()))
    setDay(todayYmd)
  }

  const countOn = (d: string) => (list ?? []).filter((r) => r.date === d).length
  const dayList = (list ?? []).filter((r) => r.date === day)

  const cancel = async (r: Reservation) => {
    setBusy(r.id)
    setActionError('')
    try {
      await staffCancelReservation(r, note)
      setCancelling(null)
      setNote('')
      await load()
    } catch (e) {
      console.error('[iLINE] 담당자 취소 실패:', e)
      setActionError(actionErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 주 이동 + 요일 탭 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => moveWeek(-1)} className="touch-target rounded-lg px-3 font-bold hover:bg-subtle" aria-label="이전 주">◀</button>
          <p className="font-bold">
            {shortDate(days[0])} ~ {shortDate(days[6])}
            <button type="button" onClick={goToday} className="ml-3 text-sm font-semibold text-brand-600 underline dark:text-brand-300">오늘</button>
          </p>
          <button type="button" onClick={() => moveWeek(1)} className="touch-target rounded-lg px-3 font-bold hover:bg-subtle" aria-label="다음 주">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="날짜">
          {days.map((d) => {
            const on = d === day
            const n = countOn(d)
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setDay(d)}
                className={
                  'touch-target rounded-lg text-xs font-bold ' +
                  (on ? 'bg-brand-600 text-white' : d === todayYmd ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'bg-subtle text-ink-muted')
                }
              >
                {/* 휴대폰(D-24): 7칸이라 '9/22(월)'이 안 들어간다 — 날짜와 요일을 두 줄로 */}
                <span className="hidden sm:inline">{shortDate(d)}</span>
                <span className="sm:hidden">
                  {fromYmd(d).getDate()}
                  <span className="block text-[10px] font-normal">{weekdayKo(fromYmd(d).getDay())}</span>
                </span>
                <span className="block text-[10px] font-semibold opacity-80">{n > 0 ? `${n}건` : '—'}</span>
              </button>
            )
          })}
        </div>

        {actionError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{actionError}</p>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">
              {longDate(day)} {day === todayYmd && <span className="ml-1 text-sm font-semibold text-brand-600 dark:text-brand-300">오늘</span>}
            </h2>
            <Link href={`/staff/reservations/add?date=${day}`} className="text-sm font-semibold text-brand-600 underline dark:text-brand-300">
              이 날에 직접 추가 →
            </Link>
          </div>

          <div className="mt-4">
            {list === null ? (
              <p className="text-sm text-ink-muted">불러오는 중…</p>
            ) : error ? (
              <EmptyState title="현황을 불러오지 못했습니다" desc={error} />
            ) : dayList.length === 0 ? (
              <EmptyState title="이 날은 예약이 없습니다" />
            ) : (
              <div className="space-y-5">
                {VENUES.map((v) => {
                  const items = dayList.filter((r) => r.venue === v.code)
                  if (items.length === 0) return null
                  return (
                    <div key={v.code} className="rounded-2xl border border-line bg-surface p-5">
                      <p className="font-bold">{venueLabel(v.code)} <span className="ml-1 text-sm font-normal text-ink-muted">{items.length}건</span></p>
                      <ul className="mt-2 divide-y divide-line text-sm">
                        {items.map((r) => (
                          <li key={r.id} className="py-2">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                              <span className="font-semibold">{hourLabel(r.startHour)}~{hourLabel(r.startHour + r.hours)}</span>
                              <span>{seatLabel(r.venue, r.seat)}</span>
                              <span>{r.source === 'staff' ? r.displayName ?? r.applicant.name : r.applicant.name}</span>
                              <span className="text-ink-muted">{[r.applicant.affiliation, r.applicant.major].filter(Boolean).join(' ')}</span>
                              <span className="text-ink-muted">{r.applicant.phone}</span>
                              <span className={'rounded-full px-2 py-0.5 text-xs font-bold ' + (r.status === 'confirmed' ? 'bg-status-approved/12 text-status-approved' : 'bg-status-submitted/12 text-status-submitted')}>
                                {RESERVATION_STATUS_LABEL[r.status]}
                              </span>
                              {r.source === 'staff' && <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-subtle">담당자 추가</span>}
                              <span className="ml-auto font-mono text-xs text-ink-subtle">{r.code}</span>
                              {cancelling !== r.id && (
                                <button type="button" onClick={() => { setCancelling(r.id); setNote('') }} className="text-xs font-semibold text-ink-muted underline">취소</button>
                              )}
                            </div>
                            {r.staffNote && <p className="mt-1 text-xs text-ink-subtle">메모: {r.staffNote}</p>}
                            {cancelling === r.id && (
                              <div className="mt-2 rounded-xl bg-subtle p-3 text-sm">
                                <p className="text-ink-muted">
                                  {r.status === 'confirmed'
                                    ? '확정된 예약입니다. 취소하면 다음 전달 명단의 「취소」 묶음에 들어갑니다.'
                                    : '접수 상태라 행정실에는 알릴 것이 없습니다.'}
                                </p>
                                <input
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  placeholder="메모 (선택) — 예: 본인 요청, 행정실 사정"
                                  className="mt-2 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button type="button" disabled={busy === r.id} onClick={() => setCancelling(null)} className="touch-target rounded-xl border border-line px-4 text-sm font-semibold">돌아가기</button>
                                  <button type="button" disabled={busy === r.id} onClick={() => cancel(r)} className="touch-target rounded-xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                                    {busy === r.id ? '취소 중…' : '예약 취소 확정'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
