'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SubNavItem {
  href: string
  label: string
  /** 칸 옆 숫자(귤색) — 관리 메뉴의 답변 대기 문의 수 등. 0 이면 안 보임 */
  badge?: number
  /** `prefix` 줄에서도 이 칸만은 주소가 똑같을 때만 켠다 — 관리 메뉴의 「신청」(`/staff`) */
  exact?: boolean
}

/**
 * 하위 메뉴 탭.
 * D-24: 모바일에서 항목이 넘치면 가로 스크롤되게 하되,
 *       본문 자체가 밀리지는 않도록 컨테이너 안에서만 스크롤한다.
 *
 * 10-02 관리 메뉴 줄(`components/staff/StaffNav.tsx`)이 같은 부품을 쓰면서 셋을 더했다 — 모양이 하나로 맞게.
 *   · `label`  — 줄 맨 앞 이름표(「관리」)
 *   · `prefix` — 하위 주소도 그 칸으로(`/staff/reservations/board` → 「예약」). 없으면 지금처럼 주소가 똑같을 때만
 *   · 지금 칸이 화면 밖이면 줄을 옆으로 밀어 보이게 — 휴대폰에서 뒤쪽 칸(「회원」)에 있을 때
 * D-124 — `trailing`: 줄 오른쪽 끝에 붙이는 것(관리 줄의 「시험 데이터 보기」 스위치)
 */
export default function SubNav({
  items,
  label,
  prefix = false,
  ariaLabel = '하위 메뉴',
  trailing,
}: {
  items: readonly SubNavItem[]
  label?: string
  prefix?: boolean
  ariaLabel?: string
  trailing?: ReactNode
}) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  const isActive = (item: SubNavItem) =>
    pathname === item.href || (prefix && !item.exact && pathname.startsWith(item.href + '/'))

  // 지금 칸이 줄 밖으로 나가 있으면 줄만 옆으로 민다(scrollIntoView 는 페이지까지 움직일 수 있어 쓰지 않는다)
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active) return
    const a = active.getBoundingClientRect()
    const n = nav.getBoundingClientRect()
    if (a.left < n.left || a.right > n.right) nav.scrollLeft += a.left - n.left - 16
  }, [pathname])

  return (
    <div className="border-b border-line bg-surface">
      <div className="container-page">
        <nav
          ref={navRef}
          className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          aria-label={ariaLabel}
        >
          {label && (
            <span className="shrink-0 pr-1 text-xs font-extrabold tracking-wide text-ink-subtle">
              {label}
            </span>
          )}
          {items.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  // D-85: 헤더 대메뉴와 같은 규칙 — hover 중립 면, 굵기는 배타적으로
                  // (font-medium 을 공통에 두면 활성 font-bold 가 진다 · Header.tsx 주석)
                  'relative shrink-0 rounded-lg px-4 py-3 text-sm transition-colors ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ' +
                  (active
                    ? 'font-bold text-theme-strong hover:bg-theme/[0.07] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-theme'
                    : 'font-medium text-ink-muted hover:bg-ink/5 hover:text-ink active:bg-ink/[0.08]')
                }
              >
                {item.label}
                {(item.badge ?? 0) > 0 && (
                  <span className="ml-1.5 rounded-full bg-warn px-1.5 py-0.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
          {trailing && <div className="ml-auto shrink-0 pl-2">{trailing}</div>}
        </nav>
      </div>
    </div>
  )
}
