'use client'

/**
 * 회원 정보 입력 폼 (가입 2단계).
 *
 * 회원가입(/signup)과 등록 이어가기(/register)가 함께 쓴다.
 * 두 곳에 같은 폼을 복사해 두면 동의 문구가 갈라질 위험이 있어 하나로 뺐다.
 *
 * ── 유형에 따라 묻는 것이 달라진다 (D-43) ──────────────────
 * 처음에는 예비교원(학생)만 받는 전제라 학번·학년이 필수였는데,
 * **교원과 일반인도 가입해야 한다**는 요구가 나왔다(09-06).
 * 학번이 없는 사람에게 학번을 요구하면 가입 자체가 막힌다.
 *
 * 유형을 먼저 고르게 하고 그에 맞는 칸만 보여준다. 안 보이는 칸은
 * **값도 비워서 저장한다** — 유형을 바꿔가며 입력하다 남은 값이 문서에
 * 박히면 나중에 시트·PDF에 엉뚱하게 튀어나온다.
 *
 * ── 초상권 동의는 여기 없다 (D-44) ─────────────────────────
 * 가입 단계에서 함께 받다가 **프로그램 신청 단계로 옮겼다**(09-07).
 * 사진은 **특정 프로그램의 활동**에서 찍히므로, 가입 시점에 한 번 받은
 * 포괄 동의로는 "어느 활동의 사진인가"에 답할 수 없다.
 * → `components/apply/PortraitConsent.tsx`
 *
 * 여기 남는 것은 **개인정보 수집·이용 동의뿐**이다. 이것은 계정을 두는 것
 * 자체의 근거라 가입 시점에 받는 것이 맞다.
 */

import { useState } from 'react'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import ConsentBlock from '@/components/ui/ConsentBlock'
import { MEMBER_TYPE_LABEL, type MemberType } from '@/lib/types'

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

const TYPES: { value: MemberType; desc: string }[] = [
  { value: 'student', desc: '대학 재학생 · 예비교원' },
  { value: 'teacher', desc: '대학 교수 · 초·중·고 교사' },
  { value: 'general', desc: '그 밖에 참여하시는 분' },
]

export interface MemberInfoValues {
  memberType: MemberType
  name: string
  /** 소속 — 학생: 대학명 · 교원: 재직 기관 · 일반: 선택 */
  affiliation: string
  major: string
  studentId: string
  grade: string
  /** 직위·직함 — 교원·일반 */
  position: string
  phone: string
  /** 개인정보 수집·이용 (필수) */
  personalInfo: boolean
  // 초상권 동의는 여기 없다 — 프로그램 신청 단계에서 받는다 (D-44)
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
  const [memberType, setMemberType] = useState<MemberType>('student')
  const [name, setName] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [major, setMajor] = useState('')
  const [studentId, setStudentId] = useState('')
  const [grade, setGrade] = useState('')
  const [position, setPosition] = useState('')
  const [phone, setPhone] = useState('')
  const [personalInfo, setPersonalInfo] = useState<boolean | null>(null)
  const [localError, setLocalError] = useState('')

  const isStudent = memberType === 'student'
  const isTeacher = memberType === 'teacher'
  const isGeneral = memberType === 'general'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')

    if (!name.trim()) return setLocalError('이름을 입력해 주세요.')

    // 소속은 학생·교원만 필수. 일반은 소속이 없을 수 있다.
    if (!isGeneral && !affiliation.trim()) {
      return setLocalError(
        isStudent ? '소속 대학을 입력해 주세요.' : '소속 기관을 입력해 주세요.'
      )
    }
    if (isStudent) {
      if (!studentId.trim()) return setLocalError('학번을 입력해 주세요.')
      if (!grade) return setLocalError('학년을 선택해 주세요.')
    }
    if (phone.replace(/[^0-9]/g, '').length < 9) {
      return setLocalError('연락처를 정확히 입력해 주세요.')
    }
    if (personalInfo !== true) {
      return setLocalError('개인정보 수집·이용에 동의하셔야 가입할 수 있습니다.')
    }

    onSubmit({
      memberType,
      name,
      affiliation,
      major,
      // 유형에 안 맞는 값은 **비워서 보낸다** (위 주석 참고)
      studentId: isStudent ? studentId : '',
      grade: isStudent ? grade : '',
      position: isStudent ? '' : position,
      phone,
      personalInfo: true,
    })
  }

  const shown = error || localError

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── 유형 선택 (D-43) ───────────────────────────── */}
      <fieldset>
        <legend className="text-sm font-semibold">가입 유형</legend>
        <p className="mt-1 text-xs text-ink-subtle">
          고르신 유형에 따라 입력하실 항목이 달라집니다.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => {
            const on = memberType === t.value
            return (
              <label
                key={t.value}
                className={
                  'cursor-pointer rounded-xl border p-3 ' +
                  (on
                    ? 'border-brand-600 bg-brand-soft'
                    : 'border-line-strong hover:bg-subtle')
                }
              >
                <input
                  type="radio"
                  name="memberType"
                  className="sr-only"
                  checked={on}
                  onChange={() => {
                    setMemberType(t.value)
                    setLocalError('')
                  }}
                />
                <span className="block text-sm font-bold">
                  {MEMBER_TYPE_LABEL[t.value]}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-subtle">
                  {t.desc}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <Field
        label="이름"
        name="name"
        required
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Field
        label={isStudent ? '소속 대학' : isTeacher ? '소속 기관' : '소속 (선택)'}
        name="affiliation"
        required={!isGeneral}
        placeholder={
          isStudent
            ? '제주대학교'
            : isTeacher
              ? '제주대학교 / ○○중학교'
              : '없으면 비워두셔도 됩니다'
        }
        value={affiliation}
        onChange={(e) => setAffiliation(e.target.value)}
      />

      {/* ── 학생 ─────────────────────────────────────── */}
      {isStudent && (
        <>
          <Field
            label="학과 · 전공"
            name="major"
            required
            hint="예: 초등교육과 / 컴퓨터교육전공"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
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
        </>
      )}

      {/* ── 교원 ─────────────────────────────────────── */}
      {isTeacher && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="학과 · 담당 교과"
            name="major"
            hint="예: 컴퓨터교육과 / 정보"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
          />
          <Field
            label="직위"
            name="position"
            hint="예: 부교수 / 교사"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
      )}

      {/* ── 일반 ─────────────────────────────────────── */}
      {isGeneral && (
        <Field
          label="직함 (선택)"
          name="position"
          hint="예: 연구원 / 강사"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
      )}

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

      {/* ── 동의서 ───────────────────────────────────────────
          초상권 동의서는 여기 없다. 프로그램 신청 화면에서 받는다 (D-44). */}
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
            <strong>수집 항목</strong> · 성명, 소속, 학과·전공, 신분 정보
            (학번·학년 또는 직위), 연락처, 이메일
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
        disabled={busy}
        className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? '처리 중…' : submitLabel}
      </button>
    </form>
  )
}
