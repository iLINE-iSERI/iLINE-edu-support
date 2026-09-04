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
                  'relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ' +
                  (active
                    ? 'text-brand-600 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand-600 dark:text-brand-300 dark:after:bg-brand-300'
                    : 'text-ink-muted hover:text-ink')
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
