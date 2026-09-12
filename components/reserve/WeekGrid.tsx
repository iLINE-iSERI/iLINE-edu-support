'use client'

/**
 * 주간 격자 — 월~금 × 시작 시각 (화면 설계 §1-3).
 *
 *   숫자 = 남은 자리 수 · 0 = 다 참 · － = 휴관
 *
 * 달력을 만들지 않는다. 고를 수 있는 날이 평일뿐이라 5열 격자면 되고,
 * ◀ ▶ 로 주를 옮긴다 (4주 범위). "가능/불가"만 있으면 "지금 들어가면
 * 잡을 수 있나"를 알 수 없어서 숫자를 그대로 보여준다.
 *
 * 휴대폰(D-24): 5열 × 9행이 좁은 화면에 안 들어가므로 **하루씩** 본다 —
 * 위에 요일 탭, 아래 시각 목록.
 */

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { START_HOURS, hourLabel } from '@/lib/config/venues'
import {
  lockedReason,
  shortDate,
  type Week,
} from '@/lib/reservations/window'
import type { ReservationSettings } from '@/lib/types'

export interface GridSelection {
  date: string
  hour: number
}

export default function WeekGrid({
  week,
  settings,
  totalSeats,
  occupancy,
  myDates,
  myBusy,
  selected,
  onSelect,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  week: Week
  settings: ReservationSettings
  totalSeats: number
  /** `{date}_{hour}` → 차 있는 자리 집합 */
  occupancy: Map<string, Set<string>>
  /** 이 공간에서 내가 이미 예약한 날 — 공간마다 하루 1건이라 그 날은 고를 수 없다 */
  myDates: Set<string>
  /** 다른 공간 예약과 겹치는 `{date}_{hour}` — 한 사람이 두 곳에 있을 수 없다 */
  myBusy: Set<string>
  selected: GridSelection | null
  onSelect: (s: GridSelection) => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}) {
  const locked = week.state !== 'open'
  const reason = lockedReason(week)

  // 휴대폰용 — 이번에 보는 하루
  const [dayIdx, setDayIdx] = useState(0)
  useEffect(() => setDayIdx(0), [week.monday])

  /**
   * 넓은 화면에서 못 고르는 칸을 눌렀을 때 **왜** 안 되는지 (09-12 iSERI 지적).
   * 칸이 좁아 이유를 안에 적을 수 없으니, 누르면 격자 아래에 한 줄로 띄운다.
   * 휴대폰 목록은 칸이 넓어 이유가 바로 적혀 있다.
   */
  const [hint, setHint] = useState<{ date: string; hour: number; state: string } | null>(null)
  useEffect(() => setHint(null), [week.monday, occupancy])

  const remaining = (date: string, hour: number) =>
    totalSeats - (occupancy.get(`${date}_${hour}`)?.size ?? 0)

  type CellState = 'closed' | 'mine' | 'busy' | 'full' | 'free'
  const cellState = (date: string, hour: number): CellState => {
    if (settings.closedDates.includes(date)) return 'closed'
    if (myDates.has(date)) return 'mine'
    if (myBusy.has(`${date}_${hour}`)) return 'busy'
    if (remaining(date, hour) <= 0) return 'full'
    return 'free'
  }

  const cellClass = (state: CellState, isSel: boolean) => {
    const base =
      'touch-target flex w-full items-center justify-center rounded-lg text-sm font-semibold transition '
    if (locked) return base + 'cursor-not-allowed bg-subtle text-ink-subtle'
    if (isSel) return base + 'bg-brand-600 text-white ring-2 ring-brand-300'
    switch (state) {
      case 'closed':
        return base + 'cursor-not-allowed text-ink-subtle'
      case 'mine':
      case 'busy':
        return base + 'cursor-not-allowed bg-subtle text-ink-subtle line-through'
      case 'full':
        return base + 'cursor-not-allowed bg-subtle text-ink-subtle'
      default:
        return base + 'bg-surface text-ink hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-line'
    }
  }

  const cellText = (state: CellState, date: string, hour: number) =>
    state === 'closed' ? '－' : String(Math.max(0, remaining(date, hour)))

  /** 못 고르는 이유 — 칸 설명(aria)·안내 줄·휴대폰 목록이 같은 문장을 쓴다 */
  const reasonOf = (state: CellState): string => {
    switch (state) {
      case 'closed':
        return '휴관일입니다.'
      case 'mine':
        return '이 공간은 그 날 이미 예약하셨습니다. 한 공간은 하루에 한 건만 예약할 수 있습니다.'
      case 'busy':
        return '같은 시간에 다른 공간 예약이 있습니다. 한 사람이 두 곳을 동시에 쓸 수 없습니다.'
      case 'full':
        return '그 시간은 자리가 다 찼습니다. 다른 시간을 골라 주세요.'
      default:
        return ''
    }
  }

  const renderCell = (date: string, hour: number) => {
    const state = cellState(date, hour)
    const isSel = selected?.date === date && selected?.hour === hour
    const blocked = state !== 'free'
    return (
      <button
        type="button"
        // 잠긴 주는 아예 못 누르고, 못 고르는 칸은 **눌러서 이유를 볼 수 있게** 둔다
        disabled={locked}
        aria-disabled={blocked || undefined}
        aria-pressed={isSel}
        title={blocked ? reasonOf(state) : undefined}
        aria-label={`${shortDate(date)} ${hourLabel(hour)} — ${
          blocked ? reasonOf(state) : `남은 자리 ${remaining(date, hour)}`
        }`}
        onClick={() => {
          if (blocked) setHint({ date, hour, state })
          else {
            setHint(null)
            onSelect({ date, hour })
          }
        }}
        className={cellClass(state, isSel)}
      >
        {cellText(state, date, hour)}
      </button>
    )
  }

  return (
    <div>
      {/* 주 이동 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="이전 주"
          className="touch-target rounded-lg px-3 font-bold hover:bg-subtle disabled:opacity-30"
        >
          ◀
        </button>
        <p className="font-bold">
          {shortDate(week.monday)} ~ {shortDate(week.friday)}
          {locked && (
            <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-subtle">
              {week.state === 'delivered' ? '전달됨' : '마감 지남'}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="다음 주"
          className="touch-target rounded-lg px-3 font-bold hover:bg-subtle disabled:opacity-30"
        >
          ▶
        </button>
      </div>

      {locked && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-muted"
        >
          {reason} 급하시면 화면 위의 문의처로 연락해 주세요.
        </p>
      )}

      {/* ── 넓은 화면: 5열 격자 ── */}
      <div className={'mt-4 hidden md:block ' + (locked ? 'opacity-60' : '')}>
        <div className="grid grid-cols-[4.5rem_repeat(5,minmax(0,1fr))] gap-1.5">
          <div />
          {week.days.map((d) => (
            <div key={d} className="text-center text-xs font-bold text-ink-muted">
              {shortDate(d)}
              {myDates.has(d) && (
                <span className="block text-[10px] font-semibold text-ink-subtle">
                  이미 예약
                </span>
              )}
            </div>
          ))}
          {START_HOURS.map((h) => (
            <Fragment key={h}>
              <div className="flex items-center text-xs font-semibold text-ink-muted">
                {hourLabel(h)}
              </div>
              {week.days.map((d) => (
                <Fragment key={`${d}_${h}`}>{renderCell(d, h)}</Fragment>
              ))}
            </Fragment>
          ))}
        </div>

        {hint && (
          <p
            role="status"
            className="mt-3 flex flex-wrap items-center gap-x-2 rounded-lg bg-subtle p-3 text-sm leading-relaxed text-ink-muted"
          >
            <span className="font-semibold text-ink">
              {shortDate(hint.date)} {hourLabel(hint.hour)}
            </span>
            <span>{reasonOf(hint.state as CellState)}</span>
            {(hint.state === 'mine' || hint.state === 'busy') && (
              <Link href="/reserve/mine" className="font-semibold text-brand-600 underline dark:text-brand-300">
                내 예약 보기
              </Link>
            )}
          </p>
        )}
      </div>

      {/* ── 휴대폰: 하루씩 ── */}
      <div className={'mt-4 md:hidden ' + (locked ? 'opacity-60' : '')}>
        <div className="grid grid-cols-5 gap-1" role="tablist" aria-label="요일">
          {week.days.map((d, i) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={dayIdx === i}
              onClick={() => setDayIdx(i)}
              className={
                'touch-target rounded-lg text-xs font-bold ' +
                (dayIdx === i
                  ? 'bg-brand-600 text-white'
                  : 'bg-subtle text-ink-muted')
              }
            >
              {shortDate(d)}
              {myDates.has(d) && <span className="block text-[10px]">예약함</span>}
            </button>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5">
          {START_HOURS.map((h) => {
            const d = week.days[dayIdx]
            const state = cellState(d, h)
            const isSel = selected?.date === d && selected?.hour === h
            const disabled = locked || state !== 'free'
            return (
              <li key={h}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSel}
                  onClick={() => onSelect({ date: d, hour: h })}
                  className={
                    'touch-target flex w-full items-center justify-between rounded-lg border px-4 text-sm ' +
                    (isSel
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : disabled
                        ? 'border-line bg-subtle text-ink-subtle'
                        : 'border-line bg-surface')
                  }
                >
                  <span className="font-semibold">{hourLabel(h)}</span>
                  <span>
                    {state === 'closed'
                      ? '휴관'
                      : state === 'mine'
                        ? '이 공간에 이미 예약한 날'
                        : state === 'busy'
                          ? '다른 공간 예약과 겹침'
                          : state === 'full'
                          ? '다 참'
                          : `자리 ${remaining(d, h)}개 남음`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="mt-3 text-xs text-ink-subtle">
        숫자 = 남은 자리 수 · 0 = 다 참 · － = 휴관 · 취소선 = 이 공간에 이미
        예약한 날이거나 다른 공간 예약과 겹치는 시간 · 주말은 휴관이라 나오지
        않습니다
      </p>
    </div>
  )
}
