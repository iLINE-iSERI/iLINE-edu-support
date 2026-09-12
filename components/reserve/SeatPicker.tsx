'use client'

/**
 * 자리 고르기 (화면 설계 §1-4) — 시간을 고른 **다음에** 나온다.
 *
 * 이 순서면 되돌아갈 일이 없다 — 이미 그 시간에 비어 있는 것만 보여주기
 * 때문이다. 개인 좌석만 배치도로 직접 고르고(창가·구석 선호가 실제로 있다),
 * 랩실·테이블은 자동 배정하되 [자리 바꾸기]로 고를 수 있다.
 */

import { useState } from 'react'
import type { Venue } from '@/lib/config/venues'
import { seatLabel } from '@/lib/config/venues'

export default function SeatPicker({
  venue,
  freeSeats,
  value,
  onChange,
}: {
  venue: Venue
  /** 고른 시간 내내 비어 있는 자리 */
  freeSeats: string[]
  value: string | null
  onChange: (seat: string) => void
}) {
  const [changing, setChanging] = useState(false)

  if (freeSeats.length === 0) {
    return (
      <p className="rounded-lg bg-subtle p-3 text-sm text-ink-muted">
        그 시간에 비어 있는 {venue.unit}이 없습니다. 다른 시간을 골라 주세요.
      </p>
    )
  }

  const taken = venue.seats.filter((s) => !freeSeats.includes(s))

  // 자동 배정 — 고를 필요 없는 공간
  if (venue.pick === 'auto' && !changing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          <strong>{value ? seatLabel(venue.code, value) : '—'}</strong>
          <span className="ml-2 text-ink-muted">
            (비어 있는 {venue.unit} {freeSeats.length}개 중 하나를 배정했습니다)
          </span>
        </p>
        {freeSeats.length > 1 && (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="text-sm font-semibold text-brand-600 underline dark:text-brand-300"
          >
            자리 바꾸기
          </button>
        )}
      </div>
    )
  }

  const cols = venue.mapColumns ?? Math.min(venue.seats.length, 4)

  return (
    <div>
      <p className="text-sm text-ink-muted">
        비어 있는 {venue.unit}을 고르세요 · <span aria-hidden>▨</span> = 이미 예약됨
      </p>
      <div
        className="mt-3 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={`${venue.unit} 선택`}
      >
        {venue.seats.map((s) => {
          const free = !taken.includes(s)
          const sel = value === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={!free}
              onClick={() => onChange(s)}
              className={
                'touch-target rounded-lg border text-sm font-bold transition ' +
                (sel
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : free
                    ? 'border-line bg-surface hover:bg-brand-50 dark:hover:bg-brand-900/30'
                    : 'cursor-not-allowed border-line bg-subtle text-ink-subtle')
              }
            >
              {free ? s : '▨'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
