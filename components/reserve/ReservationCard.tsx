'use client'

/**
 * 예약 한 건 카드 — 내 예약 목록·완료 화면에서 같이 쓴다 (화면 설계 §2).
 *
 * 상태는 둘: 접수됨 → 확정됨. "예약되었습니다"라고 쓰지 않는다 (D-53).
 * 확정은 행정실 전달 뒤에 일어나는 일이라, 접수됨 상태에서는 언제 전달되는지를
 * 함께 적어 준다.
 */

import { seatLabel, venueOf, hourLabel } from '@/lib/config/venues'
import { longDate, shortDate } from '@/lib/reservations/window'
import { RESERVATION_STATUS_LABEL, type Reservation } from '@/lib/types'

const TONE: Record<Reservation['status'], string> = {
  received: 'bg-status-submitted/12 text-status-submitted',
  confirmed: 'bg-status-approved/12 text-status-approved',
  cancelled: 'bg-subtle text-ink-subtle',
}

export function timeRange(r: Reservation): string {
  return `${hourLabel(r.startHour)} ~ ${hourLabel(r.startHour + r.hours)} (${r.hours}시간)`
}

export default function ReservationCard({
  reservation: r,
  deliverDate,
  action,
}: {
  reservation: Reservation
  /** 접수됨 상태일 때 "○/○(목)에 전달" 문구에 쓴다 — 없으면 '목요일' */
  deliverDate?: string
  action?: React.ReactNode
}) {
  const venue = venueOf(r.venue)
  const dim = r.status === 'cancelled'

  return (
    <div
      className={
        'rounded-2xl border border-line bg-surface p-5 ' +
        (dim ? 'opacity-60' : '')
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ' +
            TONE[r.status]
          }
        >
          {RESERVATION_STATUS_LABEL[r.status]}
        </span>
        <span className="font-mono text-xs text-ink-subtle">{r.code}</span>
      </div>

      <p className="mt-2 font-bold">
        {venue.name} · {seatLabel(r.venue, r.seat)}
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {longDate(r.date)} {timeRange(r)}
      </p>

      {r.status === 'received' && (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          {deliverDate ? `${shortDate(deliverDate)}에` : '목요일에'} 사범대학
          행정실로 사용 요청이 전달되면 확정됩니다.
        </p>
      )}
      {r.status === 'confirmed' && (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          행정실에 전달되어 확정된 예약입니다. 시설은 사범대학 소속이라
          행정실 사정으로 이용이 어려워지면 따로 알려드립니다.
        </p>
      )}

      {action && <div className="mt-4 flex justify-end">{action}</div>}
    </div>
  )
}
