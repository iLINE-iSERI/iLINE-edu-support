'use client'

/**
 * 창의재단 회원 등록 (2단계) — D-23의 게이트.
 *
 * 인증 계정은 그뤠잇과 공유하지만, 이 화면을 통과해야
 * 교원양성지원사업 회원이 된다.
 *
 * 여기서 받는 것은 **프로그램과 무관한 공통 항목**이다.
 * 프로그램마다 달라지는 항목은 신청서(Phase 3)에서 받는다.
 * 이렇게 나누면 신청할 때마다 이름·학번을 다시 쓰지 않아도 되고,
 * 프로그램별 폼이 확정되지 않아도 회원 등록은 먼저 열 수 있다.
 *
 * 종이 동의서 양식(2026 교원양성기관 개발지원 사업단) 기준:
 *   1. 개인정보 수집·이용 동의 (필수)
 *   2. 사진·영상 촬영 및 초상권 활용 동의 (선택)
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import ConsentBlock from '@/components/ui/ConsentBlock'
import { useAuth } from '@/components/auth/AuthProvider'
import { registerMember } from '@/lib/firebase/members'

const GRADES = [
  { value: '', label: '선택하세요' },
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
  { value: '4', label: '4학년' },
  { value: '5+', label: '5학년 이상' },
  { value: 'grad', label: '대학원' },
  { value: 'etc', label: '기타' },
] as const

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/mypage'
  const { user, status, refresh } = useAuth()

  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [major, setMajor] = useState('')
  const [grade, setGrade] = useState('')
  const [phone, setPhone] = useState('')

  const [personalInfo, setPersonalInfo] = useState<boolean | null>(null)
  const [portrait, setPortrait] = useState<boolean | null>(null)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === 'guest') {
      router.replace(`/login?next=${encodeURIComponent('/register')}`)
    }
    if (status === 'member') {
      router.replace(next)
    }
  }, [status, router, next])

  // 두 동의 모두 "선택"은 해야 넘어간다. 필수 동의는 '동의함'이어야 한다.
  const canSubmit =
    personalInfo === true && portrait !== null && grade !== '' && !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!user) {
      setError('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')
      return
    }
    if (personalInfo !== true) {
      setError('개인정보 수집·이용에 동의하셔야 등록할 수 있습니다.')
      return
    }
    if (portrait === null) {
      setError('초상권 활용 동의 여부를 선택해 주세요.')
      return
    }
    if (phone.replace(/[^0-9]/g, '').length < 9) {
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
          studentId,
          major,
          grade,
          phone,
          consents: {
            personal_info: true,
            portrait,
            // 증빙 서류 동의는 실제로 서류를 낼 때(신청 단계) 받는다
            identity_document: false,
          },
        }
      )
      await refresh()
      router.replace(next)
    } catch (err) {
      console.error(err)
      setError(
        '등록 중 문제가 발생했습니다. 보안 규칙이 아직 적용되지 않았다면 담당자에게 문의해 주세요.'
      )
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
      title="회원 등록"
      desc="사업 참여를 위해 기본 정보를 입력하고 동의서를 확인해 주세요."
    >
      <div className="mb-6 rounded-xl bg-brand-soft p-4 text-sm leading-relaxed text-ink">
        <p>
          <strong>{user?.email}</strong> 계정으로 로그인되어 있습니다.
        </p>
        <p className="mt-1 text-ink-muted">
          그뤠잇(AI 교육 플랫폼) 계정을 쓰고 계셔도, 교원양성지원사업은 별도
          등록이 필요합니다. 한 번만 하시면 됩니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="이름"
          name="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="학번"
            name="studentId"
            required
            inputMode="numeric"
            placeholder="20260000"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
          <Select
            label="학년"
            name="grade"
            required
            options={GRADES}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
        </div>

        <Field
          label="전공"
          name="major"
          required
          hint="예: 초등교육과 / 컴퓨터교육전공"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
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

        {/* ── 동의서 ─────────────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <ConsentBlock
            id="consent-personal"
            title="개인정보 수집·이용 동의서"
            required
            value={personalInfo}
            onChange={setPersonalInfo}
          >
            <p>
              <strong>수집·이용 목적</strong> · 재정지원사업 활동 참여 및 사업비
              집행
            </p>
            <p>
              <strong>수집 항목</strong> · 성명, 전공·학년·학번, 연락처, 이메일
            </p>
            <p>
              <strong>보유 및 이용 기간</strong> · 사업 종료 후 3년 (관련 법령 및
              대학 기록 보존기준 준용)
            </p>
            <p className="text-ink-subtle">
              동의를 거부할 권리가 있으며, 거부하실 경우 프로그램 참여 및 수료증
              발급이 제한될 수 있습니다.
            </p>
          </ConsentBlock>

          <ConsentBlock
            id="consent-portrait"
            title="사진·영상 촬영 및 초상권 활용 동의서"
            value={portrait}
            onChange={setPortrait}
          >
            <p>
              <strong>촬영 목적</strong> · 프로그램 운영 기록, 사업 성과보고서·
              결과 자료집 제작, 대학 홈페이지·오픈 라이브러리 게시, 대외 홍보
            </p>
            <p>
              <strong>활용 범위</strong> · 인쇄물(자료집·리플렛), 웹사이트·SNS,
              학술발표 자료, 보도자료
            </p>
            <p>
              <strong>보유 및 이용 기간</strong> · 성과보고서·오픈 라이브러리·
              자료집 등 사업의 공식 기록물에 게시·활용된 사진·영상은 사업
              기록으로서 별도의 파기 시점 없이 계속 보관·게시될 수 있습니다.
              자료 제작에 사용되지 않은 촬영 원본(미채택본)은 사업 종료 후 1년
              이내 파기합니다.
            </p>
            <p className="text-ink-subtle">
              이미 게시·활용된 사진·영상이라도 특정 건의 활용을 원하지 않으실
              경우 담당자에게 삭제(또는 모자이크 처리)를 요청하실 수 있습니다.
            </p>
          </ConsentBlock>
        </div>

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
          disabled={!canSubmit}
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
    <Suspense
      fallback={
        <AuthShell title="회원 등록">
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        </AuthShell>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
