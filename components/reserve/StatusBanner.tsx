/**
 * 예약하기 맨 위 — "어느 날짜까지 고를 수 있고, 언제 확정되는가" (화면 설계 §1-1).
 *
 * 예약은 항상 열려 있다. 「마감」은 사이트를 닫는 게 아니라 고를 수 있는
 * 첫 날짜를 한 주 미루는 것이라(D-55), "마감되었습니다" 화면은 없다.
 *
 * ⚠️ 문의 안내는 필수다 (D-53). "안 됩니다"로 끝내면 못 쓰는 줄 안다.
 *    당일·이번 주·주말·야간은 현장에서 조율해 해결할 수 있는 경우가 있다.
 */

import { SITE } from '@/lib/config/site'
import {
  closeAtLabel,
  shortDate,
  type ReservationWindow,
} from '@/lib/reservations/window'

export default function StatusBanner({ win }: { win: ReservationWindow }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm leading-relaxed dark:border-brand-800 dark:bg-brand-900/30">
      <p className="font-bold text-brand-700 dark:text-brand-200">
        📅 {shortDate(win.firstDate)} ~ {shortDate(win.lastDate)} 사이에서
        고르실 수 있습니다
      </p>
      <p className="mt-1 text-ink-muted">
        {closeAtLabel(win.closeAt)}까지 예약하시면{' '}
        <strong className="text-ink">{shortDate(win.deliverDate)}</strong>에
        사범대학 행정실로 전달되어 확정됩니다.
      </p>
      <p className="mt-3 border-t border-brand-200/60 pt-3 text-ink-muted dark:border-brand-800">
        그 전에 쓰셔야 하거나 주말·18시 이후에 쓰시려면 사이트에서는 신청할
        수 없지만, 문의하시면 가능한 경우가 있습니다 —{' '}
        <ContactLine />
      </p>
    </div>
  )
}

/**
 * 🔴 가정값 — 현장 관리자 번호를 따로 안내할지 교수님 확인 대기.
 *    확인되면 lib/config/site.ts 의 문의처를 바꾸거나 여기서 분기한다.
 */
export function ContactLine() {
  return (
    <span className="whitespace-nowrap">
      ☎ {SITE.contact.phone} ·{' '}
      <a className="underline" href={`mailto:${SITE.contact.email}`}>
        {SITE.contact.email}
      </a>
    </span>
  )
}
