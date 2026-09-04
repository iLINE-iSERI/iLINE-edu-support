'use client'

/**
 * 창의재단 회원 등록 (2단계) — D-23의 게이트.
 *
 * 인증 계정은 그뤠잇과 공유하지만, 이 화면을 통과해야
 * 교원양성지원사업 회원이 된다. 여기서 실명·소속·연락처와
 * 목적별 개인정보 동의를 받는다.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import Field from '@/components/ui/Field'
import { useAuth } from '@/components/auth/AuthProvider'
import { registerMember } from '@/lib/firebase/members'

/** 동의 항목 — 목적별로 분리해 기록한다 (§2-2 ①) */
const CONSENTS = [
  {
    id: 'signup',
    required: true,
    label: '개인정보 수집·이용 동의 (필수)',
    detail:
      '수집 항목: 성명, 소속, 직위, 연락처, 이메일 · 이용 목적: 사업 참여자 확인 및 안내 · 보유 기간: 사업 종료 후 관계 법령이 정한 기간',
  },
  {
    id: 'identity_document',
    required: true,
    label: '증빙 서류 수집 동의 (필수)',
    detail:
      '과제 신청·정산 시 신분증 사본, 재직(재학)증명서, 영수증 등을 제출받아 심사 및 정산 목적으로 이용합니다. 신분증 제출 시 주민등록번호 뒷자리는 가려서 제출해 주세요.',
  },
  {
    id: 'marketing',
    required: false,
    label: '사업 안내 메일 수신 (선택)',
    detail: '공고·일정 변경 등 사업 관련 안내를 이메일로 받습니다.',
  },
] as const

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'
  const { user, status, refresh } = useAuth()

  const [name, setName] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [position, setPosition] = useState('')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 로그인하지 않았으면 로그인부터
  useEffect(() => {
    if (status === 'guest') {
      router.replace(`/login?next=${encodeURIComponent('/register')}`)
    }
    // 이미 회원이면 다시 등록할 필요가 없다
    if (status === 'member') {
      router.replace(next)
    }
  }, [status, router, next])

  const allRequiredAgreed = CONSENTS.filter((c) => c.required).every(
    (c) => agreed[c.id]
  )
  const allAgreed = CONSENTS.every((c) => agreed[c.id])

  function toggleAll(v: boolean) {
    const nextState: Record<string, boolean> = {}
    CONSENTS.forEach((c) => (nextState[c.id] = v))
    setAgreed(nextState)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!user) {
      setError('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')
      return
    }
    if (!allRequiredAgreed) {
      setError('필수 동의 항목에 모두 동의해 주세요.')
      return
    }

    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 9) {
      setError('연락처를 정확히 입력해 주세요.')
      return
    }

    setBusy(true)
    try {
      await registerMember(
        user.uid,
        user.email || '',
        user.providerData[0]?.providerId || 'password',
        {
          name,
          affiliation,
          position,
          phone,
          agreedPurposes: CONSENTS.filter((c) => agreed[c.id]).map((c) => c.id),
        }
      )
      await refresh()
      router.replace(next)
    } catch (err) {
      console.error(err)
      setError('등록 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  if (status === 'loading' || status === 'guest') {
    return (
      <AuthShell title="회원 등록">
        <p className="text-sm text-ink-muted">확인 중입니다…</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="창의재단 회원 등록"
      desc="교원양성지원사업 이용을 위해 참여자 정보를 입력해 주세요."
    >
      {/* 그뤠잇에서 넘어온 이용자를 위한 안내 */}
      <div className="mb-6 rounded-xl bg-brand-soft p-4 text-sm leading-relaxed text-ink">
        <p>
          <strong>{user?.email}</strong> 계정으로 로그인되어 있습니다.
        </p>
        <p className="mt-1 text-ink-muted">
          그뤠잇(AI 교육 플랫폼) 계정을 쓰고 계셔도, 교원양성지원사업은 별도
          등록이 필요합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="성명"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="소속"
          name="affiliation"
          required
          hint="예: ○○초등학교 / ○○대학교 교육대학원"
          autoComplete="organization"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
        />
        <Field
          label="직위"
          name="position"
          required
          hint="예: 교사 / 예비교원"
          autoComplete="organization-title"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <Field
          label="연락처"
          name="tel"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="010-0000-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {/* 동의 */}
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">약관 동의</legend>

          <label className="mb-3 flex touch-target items-center gap-3 border-b border-line pb-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-brand-600"
              checked={allAgreed}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            전체 동의
          </label>

          <div className="space-y-3">
            {CONSENTS.map((c) => (
              <div key={c.id}>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-brand-600"
                    checked={!!agreed[c.id]}
                    onChange={(e) =>
                      setAgreed((s) => ({ ...s, [c.id]: e.target.checked }))
                    }
                  />
                  <span className="font-medium">{c.label}</span>
                </label>
                <p className="mt-1 pl-8 text-xs leading-relaxed text-ink-subtle">
                  {c.detail}
                </p>
              </div>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm text-status-revision">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !allRequiredAgreed}
          className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? '등록 중…' : '등록 완료'}
        </button>

        <p className="text-center text-xs text-ink-subtle">
          자세한 내용은{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보처리방침
          </Link>
          을 확인해 주세요.
        </p>
      </form>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthShell title="회원 등록"><p className="text-sm text-ink-muted">불러오는 중…</p></AuthShell>}>
      <RegisterForm />
    </Suspense>
  )
}
