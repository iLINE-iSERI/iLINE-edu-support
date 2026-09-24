/**
 * 상태 → 배지 색. **이 파일이 유일한 출처다** (D-97).
 *
 * ── 왜 한곳에 모으나 ─────────────────────────────────────
 * `Badge.tsx` 주석에 「색 하나에 뜻 하나」가 적혀 있었지만 **강제하는 코드가
 * 없었다.** 그래서 매핑이 다섯 곳에 흩어졌고(마이페이지 · 예약 카드 · 문의
 * 화면 **두 벌** · 산출물 카드), 그러는 동안 `open` 이 「접수중」과 「선정」
 * 두 뜻을 겸하게 됐다. 원칙이 주석에만 있으면 지켜지지 않는다.
 *
 * ── 어떻게 강제하나 ──────────────────────────────────────
 * 전부 `Record<모든상태, BadgeTone>` 이다. 상태를 하나 추가하면서 톤을 안 적으면
 * **타입 검사에서 막힌다.** "나중에 정하지" 가 불가능해지는 것이 이 구조의 값이다.
 *
 * ⚠️ 여기서 다루는 것은 **색뿐이다.** 상태 이름표는 `lib/types` 의
 *    `*_STATUS_LABEL` 이 따로 갖고 있다 — 색과 글자를 한 파일에 섞으면
 *    화면마다 다른 말을 쓰기 시작한다.
 */

import type { BadgeTone } from '@/components/ui/Badge'
import type {
  ApplicationStatus,
  SettlementStatus,
  OutputStatus,
  ReservationStatus,
  InquiryStatus,
} from '@/lib/types'

/** 신청서 */
export const APPLICATION_TONE: Record<ApplicationStatus, BadgeTone> = {
  draft: 'neutral',
  // 09-24 변경: upcoming → pending. **담당자가 아직 손대지 않은 건**이라
  // 목록에서 먼저 보여야 한다(iSERI). 「검토 중」과 갈라 둔 이유가 이것 —
  // 하나는 아무도 안 봤고, 하나는 누가 보고 있다.
  submitted: 'pending',
  // D-49 이후로 새로 부여하지 않는다 — 옛 문서 호환용으로 남긴 상태
  reviewing: 'upcoming',
  revision: 'warn',
  // 09-22 변경: open → success. 「접수중」과 같은 색이라 구분이 안 됐다
  approved: 'success',
  rejected: 'closed',
  // 09-22 변경: closed → voided. 「미선정」(결과)과 「취소됨」(없던 일)이
  // 둘 다 회색 면이라 한눈에 안 갈렸다
  cancelled: 'voided',
}

/**
 * 정산 — **지금 정산 화면은 배지를 쓰지 않고 라벨 글자만 보여 준다.**
 * 여기 정의해 두는 것은 배지를 도입할 때 색을 다시 고민하지 않기 위해서다.
 * 도입 여부는 별개 결정이므로 **이 표가 있다고 배지를 넣지 않는다.**
 */
export const SETTLEMENT_TONE: Record<SettlementStatus, BadgeTone> = {
  draft: 'neutral',
  // 🔵 정산·산출물 제출과 문의 「답변 대기」도 **담당자가 손대야 하는 것**이라
  //    `pending` 이 어울린다. 09-24 에는 신청만 바꿨다 — 화면에서 보고 정한다.
  submitted: 'upcoming',
  approved: 'open',
  paid: 'success',
  // 반려는 「끝남」이 아니라 **다시 내야 하는 것** — closed 가 아니라 warn
  rejected: 'warn',
}

/** 산출물 */
export const OUTPUT_TONE: Record<OutputStatus, BadgeTone> = {
  submitted: 'upcoming',
  revision: 'warn',
}

/** 시설 예약 */
export const RESERVATION_TONE: Record<ReservationStatus, BadgeTone> = {
  received: 'upcoming',
  // 「확정됨」은 success 로 올리지 않는다 — 흔한 상태까지 면을 채우면
  // 「선정」의 강조가 희석된다 (D-97)
  confirmed: 'open',
  cancelled: 'voided', // 09-22 변경: closed → voided
}

/** 1:1 문의 — 회원 화면과 담당자 화면이 **같은 표**를 본다 */
export const INQUIRY_TONE: Record<InquiryStatus, BadgeTone> = {
  open: 'upcoming',
  // 09-24 변경: open → success. 「접수중」과 같은 연한 청록이라 눈에 안 띄었다.
  // 회원에게 **답이 왔다는 것**은 이 흐름에서 가장 중요한 순간이다(iSERI).
  // ⚠️ success 를 쓰는 세 번째 자리다 — 더 늘리면 강조가 희석된다.
  //    「종료」가 아니라 「답변 완료」에 준 이유: 회원이 기다리던 것은 답이다.
  answered: 'success',
  closed: 'neutral',
}
