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
  isCredentialError,
} from '@/lib/firebase/auth'
import { getMember } from '@/lib/firebase/members'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  /** 자격 증명 오류일 때만 회원가입 버튼을 함께 보여준다 */
  const [showSignupHint, setShowSignupHint] = useState(false)
  const [busy, setBusy] = useState(false)

  const toRegister = `/register?next=${encodeURIComponent(next)}`

  /**
   * 로그인 성공 후 어디로 보낼지 결정한다 (D-23).
   *
   * ⚠️ 여기서 나는 오류는 **로그인 실패가 아니다.** 인증은 이미 끝났고,
   *    회원 문서를 읽는 단계에서 실패한 것이다. 이걸 로그인 오류로 표시하면
   *    "로그인 실패했다는데 헤더는 왜 로그아웃으로 바뀌지?" 하는 모순이 생긴다.
   *    그래서 실패해도 등록 화면으로 보내고, 원인 안내는 그 화면이 맡는다.
   */
  async function routeAfterLogin(uid: string) {
    try {
      const member = await getMember(uid)
      router.replace(member ? next : toRegister)
    } catch {
      router.replace(toRegister)
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setShowSignupHint(false)
    setBusy(true)
    try {
      const user = await signInWithEmail(email, password)
      await routeAfterLogin(user.uid)
    } catch (err) {
      setError(authErrorMessage(err))
      setShowSignupHint(isCredentialError(err))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setShowSignupHint(false)
    setBusy(true)
    try {
      // Google 계정은 처음이어도 이 단계에서 계정이 만들어진다.
      // 창의재단 회원 여부는 그다음에 판단한다.
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
      desc="프로그램 신청·정산은 로그인 후 이용하실 수 있습니다."
      footer={
        <>
          아직 계정이 없으신가요?{' '}
          <Link
            href="/signup"
            className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-300"
          >
            회원가입
          </Link>
        </>
      }
    >
      <GoogleButton
        onClick={handleGoogle}
        disabled={busy}
        label="Google 계정으로 계속하기"
      />
      <p className="mt-2 text-center text-xs text-ink-subtle">
        처음이신 경우 Google 계정으로 바로 가입됩니다.
      </p>

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
          <div
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-3 text-sm text-status-revision"
          >
            <p className="leading-relaxed">{error}</p>
            {showSignupHint && (
              <div className="mt-3 flex justify-center">
                <Link
                  href={`/signup?next=${encodeURIComponent(next)}`}
                  className="touch-target inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
                >
                  회원가입 하러 가기
                </Link>
              </div>
            )}
          </div>
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
        <Link
          href="/forgot-password"
          className="text-ink-muted underline underline-offset-2"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="로그인">
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
