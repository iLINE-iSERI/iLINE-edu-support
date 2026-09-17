'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 하위 메뉴 탭.
 * D-24: 모바일에서 항목이 넘치면 가로 스크롤되게 하되,
 *       본문 자체가 밀리지는 않도록 컨테이너 안에서만 스크롤한다.
 */
export default function SubNav({
  items,
}: {
  items: readonly { href: string; label: string }[]
}) {
  const pathname = usePathname()

  return (
    <div className="border-b border-line bg-surface">
      <div className="container-page">
        <nav
          className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          aria-label="하위 메뉴"
        >
          {items.map((item) => {
            const active = pathname === item.href
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
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
