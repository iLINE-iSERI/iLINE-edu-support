'use client'

/**
 * 직접 예약 추가 (화면 설계 §5, D-53 ⑥) — **없으면 운영이 안 되는 화면.**
 *
 * 단체대관 · 당일 · 주말 · 야간 · 행정실이 따로 잡아둔 자리가 전부 이
 * 통로로 들어온다. 회원 예약과 달리 마감·공간별 1건·2시간·주말을 **무시**하고,
 * 자리를 여러 개 한 번에 잡고, 이름을 직접 적는다(회원이 아니어도 됨).
 *
 * ⚠️ 회원 예약과 같은 슬롯 문서를 쓴다 — 그래야 그 시간에 회원이 같은 자리를
 *    예약하지 못한다. 시스템 밖에서 정해진 이용을 여기 넣지 않으면 우리 화면의
 *    「가능」이 거짓말이 된다 (운영 방안 §3 ④).
 */

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import { staffAddReservations } from '@/lib/firebase/reservationsStaff'
import { loadOccupancy } from '@/lib/firebase/reservations'
import { actionErrorMessage } from '@/lib/firebase/errors'
import { VENUES, venueOf, seatLabel, hourLabel } from '@/lib/config/venues'
import { toYmd, longDate } from '@/lib/reservations/window'
import type { VenueCode } from '@/lib/types'

export default function AddPage() {
  return (
    <MemberGate requireStaff>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </MemberGate>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function Content() {
  const { user } = useAuth()
  const params = useSearchParams()

  const [venueCode, setVenueCode] = useState<VenueCode>('ST')
  const [seats, setSeats] = useState<string[]>([])
  const [date, setDate] = useState(params.get('date') || toYmd(new Date()))
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(11)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(true)

  const [taken, setTaken] = useState<Map<string, Set<string>>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<string>('')

  const venue = venueOf(venueCode)

  // 그 날 그 공간의 차 있는 자리 — 고른 시간 범위에서 겹치는 자리는 표시해 준다
  useEffect(() => {
    let alive = true
    loadOccupancy(venueCode, [date])
      .then((m) => alive && setTaken(m))
      .catch((e) => console.warn('[iLINE] 현황 조회 실패:', e))
    return () => {
      alive = false
    }
  }, [venueCode, date, done])

  const takenSeatsInRange = (): Set<string> => {
    const s = new Set<string>()
    for (let h = startHour; h < endHour; h++) taken.get(`${date}_${h}`)?.forEach((x) => s.add(x))
    return s
  }
  const blocked = takenSeatsInRange()

  const toggleSeat = (s: string) =>
    setSeats((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const selectAllFree = () => setSeats(venue.seats.filter((s) => !blocked.has(s)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      const n = await staffAddReservations(
        { venue: venueCode, seats, date, startHour, endHour, displayName, phone, note, confirmed },
        user.uid
      )
      setDone(`${longDate(date)} ${hourLabel(startHour)}~${hourLabel(endHour)} · ${venue.name} ${n}자리를 넣었습니다.`)
      setSeats([])
    } catch (err) {
      console.error('[iLINE] 직접 추가 실패:', err)
      setError(actionErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const wd = new Date(date + 'T00:00:00').getDay()
  const isWeekend = wd === 0 || wd === 6
  const isPast = date < toYmd(new Date())

  return (
    <div className="container-page py-8">
      <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-6">
        <p className="rounded-xl bg-subtle p-4 text-sm leading-relaxed text-ink-muted">
          단체대관·당일·주말·야간처럼 <strong className="text-ink">사이트 밖에서 정해진 이용</strong>을 여기서
          넣습니다. 마감·하루 1건·2시간 제한을 받지 않습니다. 넣지 않으면 그 시간에
          회원이 같은 자리를 예약합니다.
        </p>

        {done && (
          <p role="status" className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm">
            {done} <Link href="/staff/reservations/board" className="ml-2 font-semibold underline">현황 보기</Link>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</p>
        )}

        {/* 공간 */}
        <fieldset>
          <legend className="text-sm font-bold">공간</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {VENUES.map((v) => (
              <label key={v.code} className={'cursor-pointer rounded-xl border p-3 text-sm ' + (venueCode === v.code ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-line bg-surface')}>
                <input type="radio" name="venue" className="sr-only" checked={venueCode === v.code} onChange={() => { setVenueCode(v.code); setSeats([]) }} />
                <span className="font-bold">{v.name}</span>
                <span className="block text-xs text-ink-muted">{v.summary}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 날짜·시간 */}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-bold">날짜</span>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSeats([]) }} className="touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3" />
            {isWeekend && <span className="mt-1 block text-xs text-ink-subtle">주말 — 회원은 못 고르지만 여기서는 됩니다</span>}
            {isPast && <span className="mt-1 block text-xs text-red-600">지난 날짜입니다</span>}
          </label>
          <label className="block text-sm">
            <span className="font-bold">시작</span>
            <select value={startHour} onChange={(e) => { const v = Number(e.target.value); setStartHour(v); if (endHour <= v) setEndHour(Math.min(24, v + 1)) }} className="touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-bold">끝</span>
            <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className="touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3">
              {HOURS.filter((h) => h > startHour).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              <option value={24}>24:00</option>
            </select>
          </label>
        </div>

        {/* 자리 */}
        <fieldset>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-bold">자리 — {seats.length}개 고름 <span className="font-normal text-ink-muted">(▨ = 그 시간에 이미 예약됨)</span></legend>
            <div className="flex gap-3 text-sm">
              <button type="button" onClick={selectAllFree} className="font-semibold text-brand-600 underline dark:text-brand-300">빈 자리 전체</button>
              <button type="button" onClick={() => setSeats([])} className="font-semibold text-ink-muted underline">모두 해제</button>
            </div>
          </div>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${venue.mapColumns ?? Math.min(venue.seats.length, 4)}, minmax(0, 1fr))` }}>
            {venue.seats.map((s) => {
              const isBlocked = blocked.has(s)
              const on = seats.includes(s)
              return (
                <label key={s} className={'touch-target flex cursor-pointer items-center justify-center rounded-lg border text-sm font-bold ' + (isBlocked ? 'cursor-not-allowed border-line bg-subtle text-ink-subtle' : on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface')}>
                  <input type="checkbox" className="sr-only" disabled={isBlocked} checked={on} onChange={() => toggleSeat(s)} />
                  {isBlocked ? '▨' : seatLabel(venueCode, s)}
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* 이름·연락처·메모 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold">이름 또는 단체명</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="예: 교육학과 스터디 동아리" className="touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3" />
          </label>
          <label className="block text-sm">
            <span className="font-bold">연락처 <span className="font-normal text-ink-muted">(선택)</span></span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-bold">메모 <span className="font-normal text-ink-muted">(선택 · 담당자만 봄)</span></span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 학과 워크숍 · 행정실 협의 완료" className="touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3" />
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <strong>행정실과 이미 협의된 이용입니다 — 바로 확정으로 넣습니다.</strong>
            <br />
            <span className="text-ink-muted">체크를 풀면 「접수됨」으로 들어가 다음 목요일 전달 명단에 포함됩니다.</span>
          </span>
        </label>

        <div className="flex justify-end">
          <button type="submit" disabled={busy || seats.length === 0} className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? '넣는 중…' : `${seats.length}자리 추가`}
          </button>
        </div>
      </form>
    </div>
  )
}
