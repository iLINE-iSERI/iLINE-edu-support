'use client'

/**
 * 회원가입 이어서 작성 (2단계).
 *
 * 계정은 있는데 회원 정보가 없는 상태를 복구하는 화면이다.
 *   · Google 로 인증한 직후
 *   · 예전에 만들다 만 계정으로 다시 로그인한 경우
 *
 * 새 이메일 가입은 /signup 에서 한 번에 끝나므로 이 화면을 거치지 않는다.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import SignupSteps from '@/components/auth/SignupSteps'
import SetupNotice from '@/components/auth/SetupNotice'
import MemberInfoForm, {
  type MemberInfoValues,
} from '@/components/auth/MemberInfoForm'
import { useAuth } from '@/components/auth/AuthProvider'
import { registerMember } from '@/lib/firebase/members'
import { firestoreErrorMessage } from '@/lib/firebase/errors'

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'
  const { user, status, refresh, errorMessage, isSetupIssue } = useAuth()

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === 'guest') {
      router.replace(`/signup?next=${encodeURIComponent(next)}`)
    }
    if (status === 'member') {
      router.replace(next)
    }
  }, [status, router, next])

  async function handleSubmit(values: MemberInfoValues) {
    setError('')
    if (!user) {
      setError('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')
      return
    }

    setBusy(true)
    try {
      await registerMember(
        user.uid,
        user.email || '',
        user.providerData[0]?.providerId || 'password',
        {
          name: values.name,
          studentId: values.studentId,
          major: values.major,
          grade: values.grade,
          phone: values.phone,
          consents: {
            personal_info: values.personalInfo,
            portrait: values.portrait,
            identity_document: false,
          },
        }
      )
      await refresh()
      router.replace(next)
    } catch (err) {
      console.error(err)
      setError(firestoreErrorMessage(err))
      setBusy(false)
    }
  }

  if (status === 'loading' || status === 'guest') {
    return (
      <AuthShell title="회원가입">
        <p className="text-sm text-ink-muted">확인 중입니다…</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="회원가입 · 2단계"
      desc="참여 정보를 입력하고 동의서를 확인하시면 가입이 완료됩니다."
      footer={
        <Link href="/login" className="underline underline-offset-2">
          다른 계정으로 로그인
        </Link>
      }
    >
      <SignupSteps current={2} />

      <div className="mb-6 rounded-xl bg-brand-soft p-4 text-sm leading-relaxed text-ink">
        <p>
          <strong>{user?.email}</strong> 계정이 확인되었습니다.
        </p>
        <p className="mt-1 text-ink-muted">
          아직 참여 정보가 등록되지 않았습니다. 아래를 작성하시면 가입이
          완료됩니다.
        </p>
      </div>

      {isSetupIssue && (
        <div className="mb-6">
          <SetupNotice message={errorMessage} />
        </div>
      )}

      <MemberInfoForm
        onSubmit={handleSubmit}
        busy={busy}
        error={error}
        submitLabel="가입 완료"
      />
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="회원가입">
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        </AuthShell>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
