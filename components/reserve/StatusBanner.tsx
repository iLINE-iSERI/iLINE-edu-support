/**
 * 예약하기 맨 위 — "어느 날짜까지 고를 수 있고, 언제 확정되는가" (화면 설계 §1-1).
 *
 * 예약은 항상 열려 있다. 「마감」은 사이트를 닫는 게 아니라 이용일 N일 전 23:59 가 지나면
 * **그 날짜만** 못 고르게 되는 것이라(D-115), "마감되었습니다" 화면은 없다.
 *
 * ⚠️ 문의 안내는 필수다 (D-53). "안 됩니다"로 끝내면 못 쓰는 줄 안다.
 *    당일·이번 주·주말·야간은 현장에서 조율해 해결할 수 있는 경우가 있다.
 *
 * 09-30 문단 다듬기 (iSERI 메모 — *"시설예약 화면 안내문구 글 문단 다듬기"*) — 예전에는 두 문장이
 * 한 문단에 이어져 있었다(마감 · 확정 / 안 되는 경우 셋 + 문의처). 훑어볼 수 있게
 * 「고를 수 있는 기간 → 마감 · 확정 두 줄 → 사이트로 안 되는 경우 목록 + 문의처」로 나눴다.
 * 숫자(며칠 전 · 날짜)는 전부 설정에서 계산한 값이다 — 문구에 박지 않는다(D-115).
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
        📅 {shortDate(win.firstOpenDate)} ~ {shortDate(win.lastDate)} 사이에서 고르실 수 있습니다
      </p>

      <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-ink-muted">
        <dt className="font-semibold text-ink">예약 마감</dt>
        <dd>
          <strong className="text-ink">이용일 {win.leadDays}일 전 23:59까지</strong>
          <span className="block text-xs">
            가장 가까운 {shortDate(win.firstOpenDate)} 이용분은 {closeAtLabel(win.closeAt)}까지
          </span>
        </dd>
        <dt className="font-semibold text-ink">확정</dt>
        <dd>담당자가 사범대학 행정실에 사용 요청을 전달하면 「확정됨」으로 바뀝니다.</dd>
      </dl>

      <div className="mt-4 border-t border-brand-200/60 pt-3 text-ink-muted dark:border-brand-800">
        <p>
          아래는 사이트에서 신청할 수 없지만, <strong className="text-ink">문의하시면 가능한 경우가 있습니다.</strong>
        </p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li>{shortDate(win.firstOpenDate)} 전에 쓰셔야 할 때</li>
          <li>주말이나 18시 이후에 쓰실 때</li>
          <li>이용 당일에 시간을 더 쓰고 싶으실 때</li>
        </ul>
        <p className="mt-2">
          <ContactLine />
        </p>
      </div>
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
