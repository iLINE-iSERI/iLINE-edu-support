'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell, { GoogleButton } from '@/components/auth/AuthShell'
import Field from '@/components/ui/Field'
import {
  signInWithEmail,
  signInWithGoogle,
  authErrorMessage,
} from '@/lib/firebase/auth'
import { getMember } from '@/lib/firebase/members'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * 로그인 후 어디로 보낼지 결정한다 (D-23).
   * 회원 문서가 없으면 — 그뤠잇에서 넘어온 경우 — 회원 등록으로 보낸다.
   */
  async function routeAfterLogin(uid: string) {
    const member = await getMember(uid)
    if (!member) {
      router.replace(`/register?next=${encodeURIComponent(next)}`)
    } else {
      router.replace(next)
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await signInWithEmail(email, password)
      await routeAfterLogin(user.uid)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      const user = await signInWithGoogle()
      await routeAfterLogin(user.uid)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="로그인"
      desc="교원양성지원사업 신청·정산은 로그인 후 이용하실 수 있습니다."
      footer={
        <>
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-300">
            회원가입
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogle} disabled={busy} label="Google로 계속하기" />

      <div className="my-5 flex items-center gap-3 text-xs text-ink-subtle">
        <span className="h-px flex-1 bg-line" />
        또는
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleEmail} className="space-y-4">
        <Field
          label="이메일"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm text-status-revision">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? '처리 중…' : '로그인'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-ink-muted underline underline-offset-2">
          비밀번호를 잊으셨나요?
        </Link>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="로그인"><p className="text-sm text-ink-muted">불러오는 중…</p></AuthShell>}>
      <LoginForm />
    </Suspense>
  )
}
