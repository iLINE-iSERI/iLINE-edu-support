/**
 * 예약이 안 되는 이유 한 줄 (09-30 · iSERI 메모 — *"예약 안되는 사유 뜨는 부분 좀 더 눈에 잘 들어오게
 * (테두리 혹은 색상 이용)"*).
 *
 * 격자 아래 안내 · 잠긴 주 안내 · 「2시간은 고를 수 없습니다」가 같은 모양을 쓴다 — 예전에는 회색 바탕
 * (`bg-subtle`)이라 설명 글과 구별되지 않았다. 주황(warn)은 「안 된다 · 확인하라」이고 빨강(오류)은 아니다.
 * 공간별 이용 제약(`venue.notice`)도 같은 색이라 「제약」은 한 가지 모양으로 읽힌다.
 */

import type { ReactNode } from 'react'

export default function ReasonNote({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      role="status"
      className={
        'flex items-start gap-2 rounded-lg border border-warn/60 bg-warn-soft px-3 py-2.5 text-sm leading-relaxed text-warn-ink ' +
        className
      }
    >
      <span aria-hidden className="shrink-0">
        ⚠️
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  )
}
