import type { ReactNode } from 'react'

/**
 * 배지 — 연한 면 + 진한 글자 (09-18 · D-81). 색 하나에 뜻 하나 (10-디자인-규칙 §2):
 *   open      청록  = 열림·긍정 (접수중 · 참여자 공유 · 선정)
 *   upcoming  슬레이트 = 기다림 (예정 · 제출됨 · 심사중)
 *   closed    회색  = 끝남 (마감 · 내려짐 · 비공개)
 *   warn      귤색  = 주의·할 일 있음 (추가 요청 · 보완 요청)
 *   info      파랑  = 알림 (고정 공지 · 내가 올린 것)
 *   group / individual  팀 · 개인 구분 (뜻 없는 분류라 파랑 · 회색)
 *   neutral   그 밖에
 * 09-18 이전에는 `bg-status-x/12` 였는데 var() 색이라 CSS 로 안 나가 **배경 없이 글자만**
 * 찍히고 있었다. 지금은 토큰이 R G B 라 투명도가 통하지만, 배지는 아예 -soft 면을 쓴다.
 */
export type BadgeTone =
  | 'open'
  | 'upcoming'
  | 'closed'
  | 'warn'
  | 'info'
  | 'group'
  | 'individual'
  | 'neutral'

const TONE: Record<BadgeTone, string> = {
  open: 'bg-accent-soft text-accent-ink',
  upcoming: 'bg-wait-soft text-wait',
  closed: 'bg-subtle text-ink-subtle',
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
