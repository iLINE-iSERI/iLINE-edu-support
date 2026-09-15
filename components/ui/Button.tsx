import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 버튼 — 사이트 전체에서 **네 종류만** 쓴다 (docs/4-기록/10-디자인-규칙.md §4 · D-72).
 *
 *   primary    주색 바탕 · 흰 글자      — 화면에서 가장 중요한 다음 단계 (제출·신청·저장).
 *                                        한 화면에 하나가 원칙
 *   secondary  테두리 · 본문색          — 보조 행동 (목록 보기 · 돌아가기 · 파일 열기)
 *   danger     주황 테두리 · 주황 글자  — 되돌리기 어려운 것 (신청 취소 · 삭제 · 반려)
 *   text       밑줄만                   — 문장 안 행동 (수정하기 · 자세히)
 *
 * 공통: 높이 44px(터치 타깃 D-24) · 모서리 12px · 글자 15px/700 · 아이콘 없음
 * (화살표는 `→` 문자). `full` 이면 가로 100% — 휴대폰 폼의 primary 에 쓴다.
 *
 * `href` 가 있으면 링크(내부는 next/link, `http` 로 시작하면 <a>)로, 없으면 <button>.
 * 09-15 이전에는 25개 파일에 인라인 클래스 10~15가지가 흩어져 있었다 —
 * 화면을 고칠 때마다 이걸로 바꿔 끼운다. 동작은 바꾸지 않는다.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text'

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl text-[15px] font-bold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-brand-600'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'touch-target px-6 bg-brand-600 text-white hover:bg-brand-700 ' +
    'dark:bg-brand-300 dark:text-brand-900 dark:hover:bg-brand-200',
  secondary:
    'touch-target px-6 border border-line-strong bg-surface text-ink hover:bg-subtle',
  danger:
    'touch-target px-5 border border-status-revision text-status-revision hover:bg-status-revision/10',
  text:
    'min-h-0 rounded-none px-1 text-sm font-semibold text-ink-muted underline underline-offset-[3px] hover:text-ink',
}

type Common = {
  variant?: ButtonVariant
  /** 가로 100% (휴대폰 폼의 primary) */
  full?: boolean
  className?: string
  children: ReactNode
}

type AsButton = Common &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'> & { href?: undefined }
type AsLink = Common &
  Omit<ComponentPropsWithoutRef<'a'>, 'className' | 'children' | 'href'> & { href: string }

export type ButtonProps = AsButton | AsLink

export default function Button(props: ButtonProps) {
  const { variant = 'primary', full, className, children, ...rest } = props
  const cls = twMerge(clsx(BASE, VARIANT[variant], full && 'w-full', className))

  if ('href' in rest && typeof rest.href === 'string') {
    const { href, ...a } = rest as AsLink
    if (/^https?:\/\//.test(href)) {
      return (
        <a href={href} className={cls} {...a}>
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={cls} {...a}>
        {children}
      </Link>
    )
  }

  const { type = 'button', ...b } = rest as AsButton
  return (
    <button type={type} className={cls} {...b}>
      {children}
    </button>
  )
}
