import Link from 'next/link'
import type { ReactNode } from 'react'

/** 로그인·회원가입·비밀번호 재설정 화면의 공통 껍데기 */
export default function AuthShell({
  title,
  desc,
  children,
  footer,
}: {
  title: string
  desc?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
          {desc && (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{desc}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>
        )}
        <p className="mt-6 text-center text-xs text-ink-subtle">
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보처리방침
          </Link>
          {' · '}
          <Link href="/terms" className="underline underline-offset-2">
            이용약관
          </Link>
        </p>
      </div>
    </div>
  )
}

/** 구글 로그인 버튼 — 로그인/회원가입 양쪽에서 쓴다 */
export function GoogleButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="touch-target flex w-full items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface font-semibold text-ink disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"
        />
        <path
          fill="#FBBC05"
          d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 9.9l7.3-5.7z"
        />
        <path
          fill="#EA4335"
          d="M24 10.4c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 3.9 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9.4 12.2-9.4z"
        />
      </svg>
      {label}
    </button>
  )
}
