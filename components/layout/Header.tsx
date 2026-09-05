'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { SITE } from '@/lib/config/site'

/**
 * 창의재단 헤더 (D-14)
 *
 * 좌: 로고 → 사업 홈(/)
 * 우: [홈(인트로 허브)] · 로그인 · 회원가입  ↔  [홈] · 로그아웃 · 마이페이지
 * 그 아래 줄에 대메뉴 4개 (D-13)
 *
 * D-24: 모바일에서는 대메뉴와 계정 영역이 햄버거 안으로 들어간다.
 */

const NAV = [
  { href: '/about', label: '사업소개' },
  { href: '/apply', label: '프로그램 신청' },
  { href: '/gallery', label: '갤러리' },
  { href: '/notice', label: '알림마당' },
] as const

export default function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const { status, member, logout } = useAuth()
  /** 담당자에게만 보이는 메뉴 — 없는 사람에게는 존재 자체를 알리지 않는다 */
  const isStaff = member?.role === 'staff'
  // 인증 신원이 있어도 회원 등록 전이면 로그인 상태로 보지 않는다 (D-23)
  const isLoggedIn = status === 'member' || status === 'withdrawn'
  // 'error'(확인 불가)일 때는 "가입 마저 하기"를 권하지 않는다.
  // 이미 회원인데 조회만 실패했을 수 있기 때문이다.
  const needsRegister = status === 'unregistered'

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
            aria-label={`${SITE.programName} 홈`}
          >
            <span className="text-lg font-extrabold tracking-tight text-brand-600 dark:text-brand-300">
              {SITE.programName}
            </span>
            <span className="hidden truncate text-xs text-ink-subtle sm:inline">
              {SITE.funder}
            </span>
          </Link>

          {/* 데스크톱 계정 영역 */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="계정">
            <a
              href={SITE.introUrl}
              className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle"
            >
              iLINE 홈
            </a>
            {isStaff && (
              <Link
                href="/staff"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-subtle"
              >
                신청 관리
              </Link>
            )}
            {isLoggedIn ? (
              <>
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle"
                >
                  로그아웃
                </button>
                <Link
                  href="/mypage"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  마이페이지
                </Link>
              </>
            ) : needsRegister ? (
              <>
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle"
                >
                  로그아웃
                </button>
                <Link
                  href="/register"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  가입 마저 하기
                </Link>
              </>
            ) : status === 'error' ? (
              <>
                <span className="rounded-lg bg-subtle px-3 py-2 text-sm text-ink-subtle">
                  회원 확인 중
                </span>
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-subtle"
                >
                  로그아웃
                </button>
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
            {isStaff && (
              <Link
                href="/staff"
                onClick={() => setOpen(false)}
                className="flex items-center rounded-lg px-3 py-3 text-base font-bold text-brand-600 dark:text-brand-300"
              >
                신청 관리
              </Link>
            )}
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
              href={SITE.introUrl}
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
                <button
                  onClick={logout}
                  className="flex w-full items-center rounded-lg px-3 py-3 text-left text-base text-ink-muted"
                >
                  로그아웃
                </button>
              </>
            ) : needsRegister ? (
              <div className="px-3 py-3">
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="touch-target flex items-center justify-center rounded-lg bg-brand-600 text-base font-semibold text-white"
                >
                  가입 마저 하기
                </Link>
              </div>
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
