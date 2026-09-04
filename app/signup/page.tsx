'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell, { GoogleButton } from '@/components/auth/AuthShell'
import Field from '@/components/ui/Field'
import {
  signUpWithEmail,
  signInWithGoogle,
  authErrorMessage,
} from '@/lib/firebase/auth'

/**
 * 계정 만들기 (1단계).
 *
 * 여기서는 인증 계정만 만든다. 실명·소속 등 창의재단 회원 정보는
 * 다음 단계인 /register 에서 받는다 (D-23).
 */
function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'
  const toRegister = `/register?next=${encodeURIComponent(next)}`

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 설정해 주세요.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setBusy(true)
    try {
      await signUpWithEmail(email, password)
      router.replace(toRegister)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
      router.replace(toRegister)
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="회원가입"
      desc="계정을 만든 뒤 사업 참여 정보를 입력하시면 등록이 완료됩니다."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-300">
            로그인
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
          name="new-password"
          type="password"
          required
          autoComplete="new-password"
          hint="8자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="비밀번호 확인"
          name="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
          {busy ? '처리 중…' : '다음'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="회원가입"><p className="text-sm text-ink-muted">불러오는 중…</p></AuthShell>}>
      <SignupForm />
    </Suspense>
  )
}
