'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 창의재단 헤더 (D-14)
 *
 * 좌: 로고 → 사업 홈(/)
 * 우: [홈(인트로 허브)] · 로그인 · 회원가입  ↔  [홈] · 로그아웃 · 마이페이지
 * 그 아래 줄에 대메뉴 4개 (D-13)
 *
 * D-24: 모바일에서는 대메뉴와 계정 영역이 햄버거 안으로 들어간다.
 *
 * ⏸ 인증 연동 전이라 지금은 비로그인 상태로 고정되어 있다.
 *    Phase 2에서 useSupportAuth() 로 교체한다.
 */

const NAV = [
  { href: '/about', label: '사업소개' },
  { href: '/apply', label: '프로그램 신청' },
  { href: '/gallery', label: '갤러리' },
  { href: '/notice', label: '알림마당' },
] as const

const INTRO_URL = process.env.NEXT_PUBLIC_INTRO_URL || 'https://iline.or.kr'

export default function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // ⏸ Phase 2에서 실제 인증 상태로 교체
  const isLoggedIn = false

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page">
        {/* 1단: 로고 + 계정 영역 */}
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="교원양성지원사업 홈"
          >
            <span className="text-lg font-extrabold tracking-tight text-brand-600 dark:text-brand-300">
              교원양성지원사업
            </span>
            <span className="hidden truncate text-xs text-ink-subtle sm:inline">
              한국과학창의재단
            </span>
          </Link>

          {/* 데스크톱 계정 영역 */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="계정">
            <a
              href={INTRO_URL}
              className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle"
            >
              iLINE 홈
            </a>
            {isLoggedIn ? (
              <>
                <button className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle">
                  로그아웃
                </button>
                <Link
                  href="/mypage"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  마이페이지
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  회원가입
                </Link>
              </>
            )}
          </nav>

          {/* 모바일 햄버거 — 터치 타깃 44px (D-24) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="touch-target -mr-2 flex items-center justify-center rounded-lg text-ink-muted md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>

        {/* 2단: 대메뉴 (데스크톱) */}
        <nav
          className="hidden gap-1 border-t border-line md:flex"
          aria-label="주요 메뉴"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={
                'relative px-4 py-3 text-sm font-medium transition-colors ' +
                (isActive(item.href)
                  ? 'text-brand-600 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand-600 dark:text-brand-300 dark:after:bg-brand-300'
                  : 'text-ink-muted hover:text-ink')
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* 모바일 메뉴 */}
      {open && (
        <div
          id="mobile-menu"
          className="border-t border-line bg-surface md:hidden"
        >
          <nav className="container-page py-2" aria-label="주요 메뉴">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={
                  'flex items-center rounded-lg px-3 py-3 text-base font-medium ' +
                  (isActive(item.href)
                    ? 'bg-subtle text-brand-600 dark:text-brand-300'
                    : 'text-ink-muted')
                }
              >
                {item.label}
              </Link>
            ))}

            <div className="my-2 border-t border-line" />

            <a
              href={INTRO_URL}
              className="flex items-center rounded-lg px-3 py-3 text-base text-ink-muted"
            >
              iLINE 홈
            </a>
            {isLoggedIn ? (
              <>
                <Link
                  href="/mypage"
                  onClick={() => setOpen(false)}
                  className="flex items-center rounded-lg px-3 py-3 text-base text-ink-muted"
                >
                  마이페이지
                </Link>
                <button className="flex w-full items-center rounded-lg px-3 py-3 text-left text-base text-ink-muted">
                  로그아웃
                </button>
              </>
            ) : (
              <div className="flex gap-2 px-3 py-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="touch-target flex flex-1 items-center justify-center rounded-lg border border-line-strong text-base font-medium text-ink"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="touch-target flex flex-1 items-center justify-center rounded-lg bg-brand-600 text-base font-semibold text-white"
                >
                  회원가입
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
