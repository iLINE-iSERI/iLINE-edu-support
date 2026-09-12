'use client'

/**
 * 예약하기 — 한 화면에서 순서대로 (화면 설계 §1).
 *
 *   ① 상태 안내 (어느 날짜까지 · 언제 확정되나)
 *   ② 공간 탭
 *   ③ 주간 격자에서 날짜·시작 시각
 *   ④ 길이 (1시간 / 2시간)
 *   ⑤ 자리 — 좌석만 배치도, 나머지는 자동
 *   ⑥ 확인 → 완료
 *
 * 신청자 정보는 입력할 것이 없다 (D-52). 회원 문서에서 복사한다.
 * 완료 화면은 "예약되었습니다"라고 말하지 않는다 (D-53).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import EmptyState from '@/components/ui/EmptyState'
import StatusBanner from './StatusBanner'
import WeekGrid, { type GridSelection } from './WeekGrid'
import SeatPicker from './SeatPicker'
import ReservationCard, { timeRange } from './ReservationCard'
import { VENUES, venueOf, venueLabel, maxHoursFrom, hourLabel, seatLabel } from '@/lib/config/venues'
import { computeWindow, longDate, type ReservationWindow } from '@/lib/reservations/window'
import {
  getReservationSettings,
  loadOccupancy,
  listMyReservations,
  activeReservations,
  createReservation,
} from '@/lib/firebase/reservations'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import { profileRows, type Reservation, type ReservationSettings, type VenueCode } from '@/lib/types'

type Step = 'pick' | 'confirm' | 'done'

export default function ReserveFlow() {
  const { member } = useAuth()

  const [settings, setSettings] = useState<ReservationSettings | null>(null)
  const [win, setWin] = useState<ReservationWindow | null>(null)
  const [loadError, setLoadError] = useState('')

  const [venueCode, setVenueCode] = useState<VenueCode>(VENUES[0].code)
  const [weekIdx, setWeekIdx] = useState(0)
  const [occupancy, setOccupancy] = useState<Map<string, Set<string>>>(new Map())
  const [occLoading, setOccLoading] = useState(false)
  /** 내 살아 있는 예약 — 공간별 하루 1건 표시와 같은 시간 겹침 표시에 쓴다 */
  const [myActive, setMyActive] = useState<Reservation[]>([])

  const [sel, setSel] = useState<GridSelection | null>(null)
  const [hours, setHours] = useState(1)
  const [seat, setSeat] = useState<string | null>(null)

  const [step, setStep] = useState<Step>('pick')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<Reservation | null>(null)

  const venue = venueOf(venueCode)
  const topRef = useRef<HTMLDivElement>(null)

  /* ── 설정·범위·내 예약 ── */
  useEffect(() => {
    if (!member) return
    let alive = true
    ;(async () => {
      try {
        const [s, mine] = await Promise.all([
          getReservationSettings(),
          listMyReservations(member.uid),
        ])
        if (!alive) return
        const w = computeWindow(s)
        setSettings(s)
        setWin(w)
        setWeekIdx(w.weeks.findIndex((x) => x.state === 'open'))
        setMyActive(activeReservations(mine))
      } catch (e) {
        console.error('[iLINE] 예약 설정 조회 실패:', e)
        if (alive) setLoadError(firestoreErrorMessage(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [member])

  /* ── 공간·주가 바뀌면 차 있는 자리 다시 조회 ── */
  const week = win?.weeks[weekIdx]
  const refreshOccupancy = useCallback(async () => {
    if (!week) return
    setOccLoading(true)
    try {
      setOccupancy(await loadOccupancy(venueCode, week.days))
    } catch (e) {
      console.error('[iLINE] 예약 현황 조회 실패:', e)
      setLoadError(firestoreErrorMessage(e))
    } finally {
      setOccLoading(false)
    }
  }, [venueCode, week])

  useEffect(() => {
    void refreshOccupancy()
  }, [refreshOccupancy])

  /* ── 이 공간에서 이미 예약한 날 · 다른 공간 예약과 겹치는 시각 ── */
  const myDates = useMemo(
    () => new Set(myActive.filter((r) => r.venue === venueCode).map((r) => r.date)),
    [myActive, venueCode]
  )
  const myBusy = useMemo(() => {
    const set = new Set<string>()
    myActive
      .filter((r) => r.venue !== venueCode)
      .forEach((r) => {
        for (let h = r.startHour; h < r.startHour + r.hours; h++) set.add(`${r.date}_${h}`)
      })
    return set
  }, [myActive, venueCode])

  /* ── 고른 시간 내내 비어 있는 자리 ── */
  const freeSeatsFor = useCallback(
    (s: GridSelection, len: number): string[] => {
      const takenAll = new Set<string>()
      for (let h = s.hour; h < s.hour + len; h++) {
        occupancy.get(`${s.date}_${h}`)?.forEach((x) => takenAll.add(x))
      }
      return venue.seats.filter((x) => !takenAll.has(x))
    },
    [occupancy, venue]
  )
  const freeSeats = useMemo(
    () => (sel ? freeSeatsFor(sel, hours) : []),
    [sel, hours, freeSeatsFor]
  )
  const canTwoHours = useMemo(
    () =>
      sel
        ? maxHoursFrom(sel.hour) >= 2 &&
          freeSeatsFor(sel, 2).length > 0 &&
          !myBusy.has(`${sel.date}_${sel.hour + 1}`)
        : false,
    [sel, freeSeatsFor, myBusy]
  )

  // 자리 자동 배정 — 자동 공간이면 첫 빈 자리, 배치도 공간이면 비움
  useEffect(() => {
    if (!sel) return
    if (seat && freeSeats.includes(seat)) return
    setSeat(venue.pick === 'auto' ? (freeSeats[0] ?? null) : null)
  }, [sel, hours, freeSeats, venue.pick, seat])

  const pickVenue = (code: VenueCode) => {
    setVenueCode(code)
    setSel(null)
    setHours(1)
    setSeat(null)
  }
  const pickSlot = (s: GridSelection) => {
    setSel(s)
    setHours(1)
    setSeat(null)
  }

  /* ── 제출 ── */
  const submit = async () => {
    if (!member || !sel || !seat || !settings) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const r = await createReservation(
        member,
        { venue: venueCode, seat, date: sel.date, startHour: sel.hour, hours },
        settings
      )
      setResult(r)
      setStep('done')
      setMyActive((prev) => [...prev, r])
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) {
      console.error('[iLINE] 예약 실패:', e)
      setSubmitError(actionErrorMessage(e))
      // 그 사이 누가 잡았을 수 있으니 현황을 다시 가져온다
      void refreshOccupancy()
      setStep('pick')
      setSeat(null)
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep('pick')
    setSel(null)
    setHours(1)
    setSeat(null)
    setAgreed(false)
    setResult(null)
    setSubmitError('')
    void refreshOccupancy()
  }

  /* ── 렌더 ── */
  if (loadError) {
    return <EmptyState title="예약 화면을 불러오지 못했습니다" desc={loadError} />
  }
  if (!win || !settings || !week || !member) {
    return <p className="text-sm text-ink-muted">불러오는 중…</p>
  }

  if (step === 'done' && result) {
    return (
      <div ref={topRef} className="space-y-6">
        <div
          role="status"
          className="rounded-2xl border border-status-approved/40 bg-status-approved/10 p-5"
        >
          <p className="text-lg font-bold text-status-approved">
            ✅ 예약 신청이 접수되었습니다
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            아직 확정은 아닙니다. 행정실에 전달되면 「내 예약」에 확정으로
            표시됩니다.
          </p>
        </div>
        <ReservationCard reservation={result} deliverDate={win.deliverDate} />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/reserve/mine"
            className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700"
          >
            내 예약 보기
          </Link>
          <button
            type="button"
            onClick={reset}
            className="touch-target inline-flex items-center justify-center rounded-xl border border-line px-6 font-semibold hover:bg-subtle"
          >
            다른 날 더 예약하기
          </button>
        </div>
      </div>
    )
  }

  if (step === 'confirm' && sel && seat) {
    const rows = profileRows(member)
    return (
      <div ref={topRef} className="space-y-6">
        <h2 className="text-lg font-bold tracking-tight">예약 내용 확인</h2>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 rounded-2xl border border-line bg-surface p-5 text-sm">
          <dt className="text-ink-muted">공간</dt>
          <dd className="font-semibold">
            {venueLabel(venueCode)} · {seatLabel(venueCode, seat)}
          </dd>
          <dt className="text-ink-muted">일시</dt>
          <dd className="font-semibold">
            {longDate(sel.date)}{' '}
            {timeRange({ startHour: sel.hour, hours } as Reservation)}
          </dd>
          {rows.map(([k, v]) => (
            <ConfirmRow key={k} k={k} v={v} />
          ))}
        </dl>
        <p className="text-xs text-ink-subtle">
          신청자 정보는 회원 정보에서 가져옵니다. 틀린 것이 있으면{' '}
          <Link href="/mypage/profile" className="underline">
            회원정보 수정
          </Link>
          에서 고친 뒤 예약해 주세요. 정보는 예약 확인 용도로만 씁니다.
        </p>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <strong>이용 수칙을 확인했습니다</strong>
            <br />· 이용 후 자리를 정리해 주세요
            <br />· 못 오시게 되면 「내 예약」에서 미리 취소해 주세요
            <br />· 시설은 사범대학 소속이라 행정실 사정에 따라 이용이 어려워질
            수 있습니다
          </span>
        </label>

        {submitError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {submitError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!agreed || submitting}
            onClick={submit}
            className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? '접수 중…' : '예약 신청하기'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setStep('pick')}
            className="touch-target inline-flex items-center justify-center rounded-xl border border-line px-6 font-semibold hover:bg-subtle"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={topRef} className="space-y-8">
      <StatusBanner win={win} />

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {submitError}
        </p>
      )}

      {/* ② 공간 */}
      <section>
        <h2 className="text-base font-bold">1. 공간</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="공간">
          {VENUES.map((v) => {
            const on = v.code === venueCode
            return (
              <button
                key={v.code}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pickVenue(v.code)}
                className={
                  'rounded-xl border p-4 text-left transition ' +
                  (on
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-900/30'
                    : 'border-line bg-surface hover:bg-subtle')
                }
              >
                <p className="font-bold">{v.name}</p>
                {v.room && <p className="text-xs text-ink-muted">{v.room}</p>}
                <p className="mt-0.5 text-xs text-ink-muted">{v.summary}</p>
                <p className="mt-1 text-xs text-ink-subtle">{v.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* ③ 날짜·시각 */}
      <section>
        <h2 className="text-base font-bold">
          2. 날짜와 시작 시각
          {occLoading && (
            <span className="ml-2 text-xs font-normal text-ink-subtle">현황 확인 중…</span>
          )}
        </h2>
        <div className="mt-3">
          <WeekGrid
            week={week}
            settings={settings}
            totalSeats={venue.seats.length}
            occupancy={occupancy}
            myDates={myDates}
            myBusy={myBusy}
            selected={sel}
            onSelect={pickSlot}
            onPrev={() => setWeekIdx((i) => Math.max(0, i - 1))}
            onNext={() => setWeekIdx((i) => Math.min(win.weeks.length - 1, i + 1))}
            canPrev={weekIdx > 0}
            canNext={weekIdx < win.weeks.length - 1}
          />
        </div>
      </section>

      {/* ④ 길이 · ⑤ 자리 */}
      {sel && (
        <section className="space-y-6 rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-base font-bold">
              3. 길이 — {longDate(sel.date)} {hourLabel(sel.hour)}부터
            </h2>
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label="길이">
              {[1, 2].map((n) => {
                const ok = n === 1 || canTwoHours
                const on = hours === n
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!ok}
                    onClick={() => setHours(n)}
                    className={
                      'touch-target rounded-xl border px-5 text-sm font-bold ' +
                      (on
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : ok
                          ? 'border-line hover:bg-subtle'
                          : 'cursor-not-allowed border-line text-ink-subtle opacity-50')
                    }
                  >
                    {n}시간
                    <span className="ml-1 text-xs font-normal opacity-80">
                      ~{hourLabel(sel.hour + n)}
                    </span>
                  </button>
                )
              })}
            </div>
            {!canTwoHours && (
              <p className="mt-2 text-xs text-ink-subtle">
                {maxHoursFrom(sel.hour) < 2
                  ? '운영 시간이 18시까지라 이 시각에는 1시간만 가능합니다.'
                  : myBusy.has(`${sel.date}_${sel.hour + 1}`)
                    ? '다음 시간에 다른 공간 예약이 있어 2시간은 고를 수 없습니다.'
                    : '다음 시간이 차 있어 2시간은 고를 수 없습니다.'}
              </p>
            )}
          </div>

          <div>
            <h2 className="text-base font-bold">4. 자리</h2>
            <div className="mt-3">
              <SeatPicker
                venue={venue}
                freeSeats={freeSeats}
                value={seat}
                onChange={setSeat}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!seat}
              onClick={() => {
                setStep('confirm')
                topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              확인하러 가기 →
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function ConfirmRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-ink-muted">{k}</dt>
      <dd>{v || '—'}</dd>
    </>
  )
}
