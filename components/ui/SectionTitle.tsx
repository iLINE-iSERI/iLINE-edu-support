import type { ReactNode } from 'react'

/**
 * 절 제목 — 화면 안 큰 구획의 h2 (docs/4-기록/10-디자인-규칙.md §3 · D-72).
 *
 * 크기 18/20px · 800, 왼쪽에 청록 세로 바(09-18 D-81 — 주색이 파랑이 되며 절 제목 바는 청록). 설명은 한 줄, 오른쪽에는
 * "전체 보기 →" 같은 링크 하나를 둘 수 있다.
 * 09-15 이전에는 `text-lg font-bold` 가 고정이라 PC 에서 카드 제목과 구분이
 * 약했다. 색이 바뀌면 바(`bg-brand-600`)만 따라간다.
 */
export default function SectionTitle({
  children,
  description,
  aside,
  as: Tag = 'h2',
  id,
  invert,
}: {
  children: ReactNode
  description?: ReactNode
  /** 제목 오른쪽 끝 — 링크 하나 */
  aside?: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  id?: string
  /** 진한 바탕(네이비 밴드) 위에 올릴 때 */
  invert?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <Tag
          id={id}
          className={
            'flex items-center gap-2.5 text-lg font-extrabold tracking-tight sm:text-xl ' +
            (invert ? 'text-white' : 'text-ink')
          }
        >
          <span
            aria-hidden="true"
            className={
              'inline-block h-[18px] w-1 shrink-0 rounded-sm ' +
              (invert ? 'bg-white/70' : 'bg-theme')
            }
          />
          {children}
        </Tag>
        {description && (
          <p
            className={
              'mt-1 text-sm leading-relaxed ' +
              (invert ? 'text-white/75' : 'text-ink-muted')
            }
          >
            {description}
          </p>
        )}
      </div>
      {aside && (
        <div
          className={
            'text-sm font-semibold ' + (invert ? 'text-white/85' : 'text-brand-600 dark:text-brand-300')
          }
        >
          {aside}
        </div>
      )}
    </div>
  )
}
