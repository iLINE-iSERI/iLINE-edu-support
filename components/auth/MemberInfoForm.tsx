'use client'

/**
 * 회원 정보 입력 폼 (가입 2단계).
 *
 * 회원가입(/signup)과 등록 이어가기(/register)가 함께 쓴다.
 * 두 곳에 같은 폼을 복사해 두면 동의 문구가 갈라질 위험이 있어 하나로 뺐다.
 */

import { useState } from 'react'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import ConsentBlock from '@/components/ui/ConsentBlock'

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

export interface MemberInfoValues {
  name: string
  studentId: string
  major: string
  grade: string
  phone: string
  /** 개인정보 수집·이용 (필수) */
  personalInfo: boolean
  /** 초상권 활용 (선택) — 거부도 기록한다 */
  portrait: boolean
}

export default function MemberInfoForm({
  onSubmit,
  busy,
  error,
  submitLabel = '가입 완료',
}: {
  onSubmit: (values: MemberInfoValues) => void
  busy: boolean
  error?: string
  submitLabel?: string
}) {
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [major, setMajor] = useState('')
  const [grade, setGrade] = useState('')
  const [phone, setPhone] = useState('')
  const [personalInfo, setPersonalInfo] = useState<boolean | null>(null)
  const [portrait, setPortrait] = useState<boolean | null>(null)
  const [localError, setLocalError] = useState('')

  const canSubmit =
    personalInfo === true && portrait !== null && grade !== '' && !busy

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')

    if (personalInfo !== true) {
      setLocalError('개인정보 수집·이용에 동의하셔야 가입할 수 있습니다.')
      return
    }
    if (portrait === null) {
      setLocalError('초상권 활용 동의 여부를 선택해 주세요.')
      return
    }
    if (phone.replace(/[^0-9]/g, '').length < 9) {
      setLocalError('연락처를 정확히 입력해 주세요.')
      return
    }

    onSubmit({
      name,
      studentId,
      major,
      grade,
      phone,
      personalInfo: true,
      portrait,
    })
  }

  const shown = error || localError

  return (
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
            기록으로서 별도의 파기 시점 없이 계속 보관·게시될 수 있습니다. 자료
            제작에 사용되지 않은 촬영 원본(미채택본)은 사업 종료 후 1년 이내
            파기합니다.
          </p>
          <p className="text-ink-subtle">
            이미 게시·활용된 사진·영상이라도 특정 건의 활용을 원하지 않으실 경우
            담당자에게 삭제(또는 모자이크 처리)를 요청하실 수 있습니다.
          </p>
        </ConsentBlock>
      </div>

      {shown && (
        <p
          role="alert"
          className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm leading-relaxed text-status-revision"
        >
          {shown}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? '처리 중…' : submitLabel}
      </button>
    </form>
  )
}
