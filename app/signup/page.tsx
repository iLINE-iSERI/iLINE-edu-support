'use client'

/**
 * 회원가입 — 한 화면 2단계.
 *
 * ⚠️ 설계 핵심: **이메일 가입은 마지막에 계정을 만든다.**
 *
 *    예전에는 1단계에서 곧바로 Auth 계정을 만들고 2단계로 넘겼다.
 *    그래서 2단계를 채우지 않고 이탈하면 "계정은 있는데 회원은 아닌"
 *    어중간한 상태가 남았다. 그 상태로 다시 회원가입을 누르면
 *    이메일 중복 오류가 나고, 로그인을 거쳐야만 이어갈 수 있었다.
 *
 *    이제는 두 단계 입력을 모두 마친 뒤에야 계정을 만들고 회원 문서까지
 *    한 번에 생성한다. 중간에 이탈하면 **아무것도 남지 않는다.**
 *
 *    다만 Google 가입은 예외다. 팝업에서 인증하는 순간 계정이 생기므로
 *    이 방식을 쓸 수 없다. 그래서 Google 경로와, 과거에 생긴 미완료
 *    계정은 "이어서 작성" 흐름으로 처리한다.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell, { GoogleButton } from '@/components/auth/AuthShell'
import SignupSteps from '@/components/auth/SignupSteps'
import SetupNotice from '@/components/auth/SetupNotice'
import MemberInfoForm, {
  type MemberInfoValues,
} from '@/components/auth/MemberInfoForm'
import Field from '@/components/ui/Field'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  signUpWithEmail,
  signInWithGoogle,
  authErrorMessage,
} from '@/lib/firebase/auth'
import { registerMember } from '@/lib/firebase/members'
import { firestoreErrorMessage } from '@/lib/firebase/errors'

function SignupFlow() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'
  const { user, status, refresh, errorMessage, isSetupIssue } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * 이미 인증까지 끝난 상태로 들어온 경우:
   *   member       → 가입 완료. 원래 가려던 곳으로
   *   unregistered → 계정만 있는 미완료 상태. 2단계부터 이어간다
   *   error        → 회원 여부 확인 불가. 역시 2단계에서 안내
   * 이 처리가 없어서, 다시 방문해 "회원가입"을 누르면 막히던 문제가 있었다.
   */
  useEffect(() => {
    if (status === 'member') {
      router.replace(next)
    } else if (status === 'unregistered' || status === 'error') {
      setStep(2)
    }
  }, [status, router, next])

  /** 이미 인증된 사용자인가 — Google 경로이거나 미완료 계정 복구 */
  const alreadyAuthed = status === 'unregistered' || status === 'error'

  function handleStep1(e: React.FormEvent) {
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
    // 계정은 아직 만들지 않는다. 2단계를 마쳐야 만든다.
    setStep(2)
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
      // 인증 완료. AuthProvider 가 상태를 갱신하면 위 useEffect 가 2단계로 넘긴다.
      setStep(2)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  /** 2단계 제출 — 여기서 계정 생성과 회원 등록이 함께 일어난다 */
  async function handleFinish(values: MemberInfoValues) {
    setError('')
    setBusy(true)
    try {
      let uid = user?.uid
      let mail = user?.email || ''
      let provider = user?.providerData[0]?.providerId || 'password'

      if (!alreadyAuthed && !uid) {
        // 이메일 경로 — 이 시점에 비로소 계정을 만든다
        const created = await signUpWithEmail(email, password)
        uid = created.uid
        mail = created.email || email
        provider = 'password'
      }

      if (!uid) {
        setError('계정 정보를 확인할 수 없습니다. 처음부터 다시 시도해 주세요.')
        setBusy(false)
        return
      }

      await registerMember(uid, mail, provider, {
        name: values.name,
        studentId: values.studentId,
        major: values.major,
        grade: values.grade,
        phone: values.phone,
        consents: {
          personal_info: values.personalInfo,
          portrait: values.portrait,
          // 증빙 서류 동의는 실제로 서류를 낼 때(신청 단계) 받는다
          identity_document: false,
        },
      })

      await refresh()
      router.replace(next)
    } catch (err) {
      console.error(err)
      // 계정 생성 단계 오류와 회원 문서 저장 오류를 구분해서 안내
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : ''
      setError(
        code.startsWith('auth/')
          ? authErrorMessage(err)
          : firestoreErrorMessage(err)
      )
      setBusy(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthShell title="회원가입">
        <p className="text-sm text-ink-muted">확인 중입니다…</p>
      </AuthShell>
    )
  }

  // ── 2단계 ────────────────────────────────────────────────
  if (step === 2) {
    return (
      <AuthShell
        title="회원가입 · 2단계"
        desc="참여 정보를 입력하고 동의서를 확인하시면 가입이 완료됩니다."
      >
        <SignupSteps current={2} />

        {alreadyAuthed ? (
          <div className="mb-6 rounded-xl bg-brand-soft p-4 text-sm leading-relaxed text-ink">
            <p>
              <strong>{user?.email}</strong> 계정이 확인되었습니다.
            </p>
            <p className="mt-1 text-ink-muted">
              아래 정보를 입력하시면 가입이 끝납니다.
            </p>
          </div>
        ) : (
          <div className="mb-6 rounded-xl bg-subtle p-4 text-sm leading-relaxed">
            <p className="text-ink">
              <strong>{email}</strong> 로 가입합니다.
            </p>
            <p className="mt-1 text-ink-subtle">
              아래를 모두 작성하고 <strong>가입 완료</strong>를 누르셔야 계정이
              만들어집니다.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-2 text-xs font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-300"
            >
              이메일·비밀번호 다시 입력
            </button>
          </div>
        )}

        {isSetupIssue && (
          <div className="mb-6">
            <SetupNotice message={errorMessage} />
          </div>
        )}

        <MemberInfoForm
          onSubmit={handleFinish}
          busy={busy}
          error={error}
          submitLabel="가입 완료"
        />
      </AuthShell>
    )
  }

  // ── 1단계 ────────────────────────────────────────────────
  return (
    <AuthShell
      title="회원가입 · 1단계"
      desc="먼저 로그인에 쓸 계정 정보를 입력합니다. 다음 단계까지 마치셔야 가입이 완료됩니다."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-300"
          >
            로그인
          </Link>
        </>
      }
    >
      <SignupSteps current={1} />

      <GoogleButton
        onClick={handleGoogle}
        disabled={busy}
        label="Google 계정으로 시작하기"
      />

      <div className="my-5 flex items-center gap-3 text-xs text-ink-subtle">
        <span className="h-px flex-1 bg-line" />
        또는
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleStep1} className="space-y-4">
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
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm text-status-revision"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          다음 단계로
        </button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="회원가입">
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        </AuthShell>
      }
    >
      <SignupFlow />
    </Suspense>
  )
}
