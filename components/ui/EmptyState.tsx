import type { ReactNode } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

/**
 * 빈 상태 카드 — 사이트 전체의 표준 (D-84 · 09-18).
 *
 * `/outputs` 로그인 전 화면(제목이 기능 설명이 아니라 **이용자 이득**, 다음 행동 버튼)이
 * 잘 되어 있어 그것을 표준으로 올렸다. 흰 카드 · **왼쪽 정렬** · 아이콘 칩(테마 색) ·
 * 다음 행동 버튼 하나 이상. 회색 상자(bg-subtle)는 캔버스 위에서 카드로도 빈 영역으로도
 * 안 읽혀서 뺐다. 설명은 두 문장 이내 — 길어지면 카드를 키우지 말고 문구를 줄인다.
 *
 * 세 변형: gate(로그인 필요 · log-in) · preparing(준비 중 · 화면 성격에 맞는 아이콘) ·
 * empty(0건 · inbox 기본, 자료실은 folder-open). 아이콘 경로는 lucide 공식 소스에서 그대로.
 *
 * 옛 호출(`title` · `desc` · `action`)도 그대로 받는다 — 26곳이 쓰고 있어 한 번에 표준이 된다.
 * 오류 안내("불러오지 못했습니다")에도 같은 카드를 쓴다 — "아직 없음"과 "오류"는 문구로 구분.
 */

export type EmptyVariant = 'gate' | 'preparing' | 'empty'

/** lucide 아이콘 경로 (viewBox 24) — 공식 svg 에서 그대로 옮김 */
export const EMPTY_ICONS = {
  'log-in': (
    <>
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  images: (
    <>
      <path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16" />
      <path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" />
      <circle cx="13" cy="7" r="1" fill="currentColor" />
      <rect x="8" y="2" width="14" height="14" rx="2" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  'folder-open': (
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  ),
} as const

export type EmptyIcon = keyof typeof EMPTY_ICONS

const DEFAULT_ICON: Record<EmptyVariant, EmptyIcon> = {
  gate: 'log-in',
  preparing: 'images',
  empty: 'inbox',
}

type Action = { label: string; href?: string; onClick?: () => void }

export default function EmptyState({
  variant = 'empty',
  icon,
  badge,
  title,
  description,
  desc,
  primaryAction,
  secondaryAction,
  action,
}: {
  variant?: EmptyVariant
  icon?: EmptyIcon
  badge?: string
  title: string
  description?: string
  /** 옛 이름 — description 과 같다 */
  desc?: string
  primaryAction?: Action
  secondaryAction?: Action
  /** 옛 방식 — 버튼을 직접 넘길 때 */
  action?: ReactNode
}) {
  const text = description ?? desc
  const iconName = icon ?? DEFAULT_ICON[variant]
  const hasButtons = primaryAction || secondaryAction || action

  return (
    <div className="empty-card mx-auto max-w-[34rem] p-6 sm:px-7 sm:py-8">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            {EMPTY_ICONS[iconName]}
          </svg>
        </span>
        {badge && <Badge tone="upcoming">{badge}</Badge>}
      </div>
      <p className="text-[1.0625rem] font-bold text-ink">{title}</p>
      {text && (
        <p className="mt-2 max-w-[30rem] break-keep text-sm leading-[1.7] text-ink-muted">{text}</p>
      )}
      {hasButtons && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {primaryAction &&
            (primaryAction.href ? (
              <Button href={primaryAction.href} className="max-sm:w-full">
                {primaryAction.label}
              </Button>
            ) : (
              <Button onClick={primaryAction.onClick} className="max-sm:w-full">
                {primaryAction.label}
              </Button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <Button variant="secondary" href={secondaryAction.href} className="max-sm:w-full">
                {secondaryAction.label}
              </Button>
            ) : (
              <Button variant="secondary" onClick={secondaryAction.onClick} className="max-sm:w-full">
                {secondaryAction.label}
              </Button>
            ))}
          {action}
        </div>
      )}
    </div>
  )
}
