import type { ReactNode } from 'react'

/**
 * 배지 — 연한 면 + 진한 글자 (09-18 · D-81). 색 하나에 뜻 하나 (10-디자인-규칙 §2):
 *   open      청록      = 열림 (접수중 · 참여자 공유 · 예약 확정)
 *   success   면 채움   = 최종 긍정 종착점 (선정 · 지급 완료 · 답변 완료)
 *   pending   슬레이트+굵은테 = **아직 아무도 손 안 댄 것** (제출 완료)
 *   upcoming  슬레이트 = 기다림 (접수 예정 · 검토 중 · 예약 접수됨)
 *   closed    연한 테두리 = 끝남 (마감 · 내려짐 · 비공개 · 미선정)
 *   voided    회색 면만 = 무효 (취소됨) — 셋 중 가장 약하게
 *   warn      귤색      = 주의·할 일 있음 (추가 요청 · 보완 요청)
 *   info      파랑      = 알림 (고정 공지 · 내가 올린 것)
 *   group / individual  팀 · 개인 구분 (뜻 없는 분류라 파랑 · 회색)
 *   neutral   그 밖에
 *
 * 09-18 이전에는 `bg-status-x/12` 였는데 var() 색이라 CSS 로 안 나가 **배경 없이 글자만**
 * 찍히고 있었다. 지금은 토큰이 R G B 라 투명도가 통하지만, 배지는 아예 -soft 면을 쓴다.
 *
 * ── 09-22 (D-97) 에 고친 것 ────────────────────────────────
 * `open` 이 「접수중」과 「선정」 **두 뜻을 겸하고** 있었다. 「색 하나에 뜻 하나」가
 * 주석에만 있고 강제하는 코드가 없어서, 원칙이 스스로 깨져 있었던 것이다.
 *   · `success` 를 떼어 **최종 긍정 종착점**(선정 · 지급 완료)만 준다.
 *     예약 「확정됨」은 `open` 에 남긴다 — 흔한 상태까지 주면 강조가 희석된다.
 *   · 회색 셋(「제출 완료」·「미선정」·「취소됨」)은 **색으로 안 갈린다** — 09-24 실측.
 *     그래서 **무게**로 가른다: 제출 완료(2px 테) > 미선정(1px 테) > 취소됨(면만).
 * 상태→톤 매핑은 흩어 두지 않는다 — **`lib/ui/statusTone.ts` 하나**가 유일한 출처다.
 */
export type BadgeTone =
  | 'open'
  | 'success'
  | 'pending'
  | 'upcoming'
  | 'closed'
  | 'voided'
  | 'warn'
  | 'info'
  | 'group'
  | 'individual'
  | 'neutral'

const TONE: Record<BadgeTone, string> = {
  open: 'bg-accent-soft text-accent-ink',
  // 면과 글자가 한 쌍 — 다크에서 둘이 같이 뒤집힌다 (globals.css `--success-*`)
  success: 'bg-success text-success-on',
  // 09-24: 담당자 목록에서 **처리해야 할 것**이 먼저 보이게 (iSERI).
  // `upcoming` 을 통째로 굵게 하지 않은 이유 — 거기엔 「접수 예정」 프로그램도
  // 들어 있는데, 그건 담당자가 할 일이 아니라 그냥 미래다. 목록에서 튀면 안 된다.
  pending: 'bg-wait-soft text-wait ring-2 ring-inset ring-wait/40',
  upcoming: 'bg-wait-soft text-wait',
  // 면 없이 **연한 테두리** — 회색 면보다 **더** 또렷하다.
  // 09-24 실측: `bg-subtle` 면은 흰 카드 위에서 거의 안 보이는데 1px 테두리는
  // 보인다. 그래서 「미선정」(결과가 나온 것)에 이쪽을 준다.
  closed: 'bg-transparent text-ink-subtle ring-1 ring-inset ring-line',
  // 회색 면만 — 셋 중 **가장 약하다.** 「없던 일이 된 건」이라 그래야 한다.
  // ⚠️ 09-24 에 두 번 고쳤다: 취소선을 그었다가(과했다) → 테두리로 →
  //    「취소됨이 미선정보다 눈에 띈다」(iSERI)로 **closed 와 맞바꿨다.**
  //    글자는 셋 다 `text-ink-subtle` 그대로 — 더 흐리게 하면 대비가 4.5:1
  //    아래로 떨어진다. 세기는 **면과 테두리의 무게**로만 만든다.
  //    무게 순서: 제출 완료(2px 테) > 미선정(1px 테) > 취소됨(면만)
  voided: 'bg-subtle text-ink-subtle',
  warn: 'bg-warn-soft text-warn-ink',
  info: 'bg-brand-soft text-brand-700',
  group: 'bg-brand-soft text-brand-700',
  individual: 'bg-subtle text-ink-muted',
  neutral: 'bg-subtle text-ink-muted',
}

export default function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ' +
        TONE[tone]
      }
    >
      {children}
    </span>
  )
}
