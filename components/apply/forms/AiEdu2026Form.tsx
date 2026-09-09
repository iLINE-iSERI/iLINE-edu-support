'use client'

/**
 * 「AI-EDU 연구반」 전용 신청 항목 (2026 · D-50).
 *
 * ── 이 파일이 한 프로그램에만 쓰이는 이유 ─────────────────────
 * 프로그램마다 신청 항목이 다르다. 그렇다고 '모든 경우를 담는 폼'을
 * 설계하려다 막혔던 것이 D-29 이고, 그래서 기본 신청서는 **자유 기재란
 * 하나 + 첨부 하나**로 줄였다.
 *
 * 그런데 이 프로그램은 팀 구성·연구 계획처럼 **미리 정해진 항목**이 많아
 * 자유 기재란으로는 담기지 않는다. 그래서 **이 프로그램 전용 화면**을
 * 따로 만든다. 다른 프로그램은 이 파일을 쳐다보지도 않는다.
 *
 * 다음 프로그램이 또 다른 양식을 요구하면 **파일을 하나 더** 만들고
 * `lib/forms/index.ts` 에 한 줄 등록하면 된다. 서너 개 쌓여 공통점이
 * 보일 때 묶어도 늦지 않다 — 지금 추상화하면 틀린 추상화가 된다.
 *
 * ── 팀을 어떻게 다루는가 ───────────────────────────────────
 * 원본 구글 폼은 **팀원이 각자 제출하고 팀명으로 묶는** 방식이다.
 * 대표자가 팀원 개인정보를 대신 입력하지 않으므로 **대리 수집 문제가
 * 없고**, Q-19 에서 정한 '모드 2 — 팀이어도 각자 신청'과 그대로 맞는다.
 * 그래서 `participationType` 은 `individual` 로 두고, 팀은 **항목으로만**
 * 받는다. 1인 1건 중복 방지와도 부딪히지 않는다.
 */

import Field from '@/components/ui/Field'

/** 프로그램 문서의 `formType` 에 넣는 값 */
export const AI_EDU_2026 = 'ai-edu-2026'

type Values = Record<string, string>

/* ── 선택지 ───────────────────────────────────────────────── */

const LESSON_TYPES = [
  '생성형 AI (창작, 대화형 학습 콘텐츠 등)',
  '데이터 과학 (지역 공공데이터 분석, 문제 해결 등)',
  '피지컬 AI 융합 (센서 기반 데이터 분석, 피지컬 컴퓨팅 등)',
  'AI 윤리 (편향성 검증, 저작권, 팩트체크 토론 등)',
  '맞춤형 학습·피드백 (AI 튜터, 자동 첨삭·피드백 등)',
] as const

const SCHOOL_LEVELS = ['중학교', '고등학교', '중등(통합형)'] as const

const SUBJECTS = [
  '국어',
  '수학',
  '영어',
  '사회',
  '과학',
  '정보',
  '체육',
  '예술(음악·미술)',
] as const

/**
 * 융합 수업 유형 안내 — 원본 그림표를 글자표로 옮긴 것.
 *
 * ✅ 2026-09-09 **원본 이미지와 대조 완료.** 고친 곳 세 군데:
 *    ① '데이터 과학' 핵심 개념이 틀렸었다
 *       ("데이터 수집·분석·시각화로 문제 해결" → 지역 특화 공공데이터)
 *    ② '생성형 AI' 전공 조합에서 **'사회'가 빠져** 있었다
 *    ③ **「예시 활동」 열이 통째로 빠져** 있었다
 *
 * ⚠️ 원본에 `대양광 모듈` 로 적혀 있으나 **`태양광`의 오타로 보고** 고쳐
 *    적었다(조도센서와 함께 전력 수요를 분석하는 맥락). 원본을 그대로
 *    두어야 한다면 되돌린다.
 *
 * 📌 **교과를 나열했으면 「… 등」으로 끝낸다** (iSERI 지시, 09-09).
 *    적어 둔 교과는 **예시일 뿐 닫힌 목록이 아니다.** '등'이 없으면
 *    그 교과가 아닌 사람은 "우리는 해당 없구나" 하고 지나칩니다.
 *
 *    ⚠️ **`전 교과` · `자율` 처럼 이미 전체를 뜻하는 말에는 붙이지 않는다.**
 *    '등'은 *"여기 없는 것도 된다"* 는 뜻인데, 전체를 뜻하는 말 뒤에서는
 *    가리킬 나머지가 없어 군더더기가 된다.
 *    → 줄을 더하거나 고칠 때 **나열한 경우에만** 끝을 '등'으로 맞추세요.
 *
 * [유형, 핵심 개념, 예시 활동(줄 단위), 전공 조합]
 */
const TYPE_GUIDE: [string, string, string[], string][] = [
  [
    '생성형 AI',
    '텍스트·이미지·음성 생성 AI로 창작 / 대화형 학습 콘텐츠',
    [
      '대화형 생성 AI를 활용한 작문·토론 등의 탐구 수업',
      '이미지·음성 생성 AI를 활용한 예술 창작 수업 등',
    ],
    '사회, 국어, 미술, 음악, 정보 등',
  ],
  [
    '데이터 과학',
    '지역 특화 공공데이터를 AI로 분석해 문제 해결',
    ['외국인 관광객 리뷰 감성 분석', '대중교통 최적 배차 분석'],
    '영어, 사회, 수학, 지리, 정보 등',
  ],
  [
    '피지컬 AI 융합',
    '센서로 정보 수집 후 AI로 분석·시각화',
    [
      '조도센서, 태양광 모듈 등으로 데이터를 수집하고, AI로 전력 수요 분석',
      '운동 자세 실시간 교정',
    ],
    '정보, 과학, 수학, 체육, 기술·가정 등',
  ],
  [
    'AI 윤리',
    'AI의 편향성, 저작권, 신뢰성 판단 등 비판적 사고 훈련',
    ['생성형 AI 결과물의 편향 사례 분석, 팩트 체크 및 저작권 토론 수업'],
    '윤리, 사회, 국어, 정보 등',
  ],
  [
    '맞춤형 학습·피드백',
    'AI 기반 개인화 학습 및 자동 피드백/평가',
    [
      'AI 튜터를 활용한 수준별 문제풀이',
      'AI 자동 첨삭·피드백 시스템 체험 수업',
    ],
    '전 교과',
  ],
  ['기타', '자율', ['자율'], '자율'],
]

/** 운영 일정 — 원본 폼의 그림 띠를 글자표로 옮긴 것 */
const SCHEDULE: [string, string, string][] = [
  ['1', '9/18(금)', '오리엔테이션 — 운영 안내 및 자료 배포'],
  ['2', '9/18(금) ~ 10/28(수)', '연구반 운영 — 기간 중 최소 3회 팀별 모임'],
  ['3', '10/29(목)', '최종보고서 제출 — 문제정의서 · 수업지도안 등'],
  ['4', '10/30(금)', '최종 발표회 및 우수팀 선정'],
]

/* ── 저장 형태로 바꾸기 ───────────────────────────────────── */

/**
 * 화면 값 → 신청서에 저장할 `{라벨, 값}` 목록.
 *
 * ⚠️ **라벨을 함께 저장한다.** 키만 남기면 나중에 이 파일을 고쳤을 때
 *    옛 신청서가 무슨 질문에 답한 것인지 알 수 없게 된다 (D-50 주석 참고).
 */
export function toRows(v: Values): { label: string; value: string }[] {
  const isLeader = v.role === '팀장'
  const rows: { label: string; value: string }[] = [
    { label: '팀명', value: v.teamName ?? '' },
    { label: '팀에서의 역할', value: v.role ?? '' },
  ]

  // 팀원은 연구 계획을 쓰지 않는다 — 팀장이 팀을 대표해 한 번만 낸다.
  // 안 물어본 항목은 줄 자체를 만들지 않는다(D-43에서 배운 것).
  if (isLeader) {
    const etc = v.lessonTypeEtc?.trim()
    rows.push(
      {
        label: '융합 수업 유형',
        value: v.lessonType === '기타' && etc ? `기타 — ${etc}` : v.lessonType ?? '',
      },
      { label: '대상 학교급', value: v.schoolLevel ?? '' },
      { label: '주교과 및 연계 융합교과', value: subjectsOf(v).join(', ') },
      { label: '주교과(대표 교과)', value: v.mainSubject ?? '' },
      { label: '다뤄보고 싶은 수업 주제', value: v.topic ?? '' }
    )
  }

  rows.push(
    { label: '지원 자격 확인', value: v.agreeQualify === 'y' ? '확인함' : '' },
    { label: '이수 기준 확인', value: v.agreeCriteria === 'y' ? '확인함' : '' },
    { label: '주요 일정 확인', value: v.agreeSchedule === 'y' ? '확인함' : '' }
  )

  return rows
}

function subjectsOf(v: Values): string[] {
  const picked = (v.subjects ?? '').split(',').filter(Boolean)
  const etc = v.subjectsEtc?.trim()
  return etc ? [...picked, `기타 — ${etc}`] : picked
}

/* ── 검증 ─────────────────────────────────────────────────── */

/** 문제가 있으면 안내 문구, 없으면 null */
export function validate(v: Values): string | null {
  if (v.agreeQualify !== 'y') return '지원 자격 요건을 확인해 주세요.'
  if (v.agreeCriteria !== 'y') return '연구반 이수 기준을 확인해 주세요.'
  if (!v.teamName?.trim()) return '팀명을 입력해 주세요.'
  if (!v.role) return '팀에서의 역할을 선택해 주세요.'

  if (v.role === '팀장') {
    if (!v.lessonType) return '융합 수업 유형을 선택해 주세요.'
    if (v.lessonType === '기타' && !v.lessonTypeEtc?.trim()) {
      return "융합 수업 유형에서 '기타'를 고르셨습니다. 어떤 유형인지 적어 주세요."
    }
    if (!v.schoolLevel) return '대상 학교급을 선택해 주세요.'
    if (subjectsOf(v).length === 0) return '주교과 및 연계 융합교과를 선택해 주세요.'
    if (!v.mainSubject?.trim()) return '주교과(대표 교과)를 입력해 주세요.'
    if (!v.topic?.trim()) return '다뤄보고 싶은 수업 주제를 적어 주세요.'
  }

  if (v.agreeSchedule !== 'y') return '연구반 주요 일정을 확인해 주세요.'
  return null
}

/* ── 화면 ─────────────────────────────────────────────────── */

export default function AiEdu2026Form({
  value: v,
  onChange,
}: {
  value: Values
  onChange: (key: string, val: string) => void
}) {
  const isLeader = v.role === '팀장'

  const toggleSubject = (s: string) => {
    const cur = (v.subjects ?? '').split(',').filter(Boolean)
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    onChange('subjects', next.join(','))
  }

  return (
    <div className="space-y-6">
      {/* ── 1. 지원 자격 ─────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold">지원 자격 확인</h2>

        <Guide title="팀 구성 필수 요건">
          <li>
            <strong>참여 대상</strong> — 본교 사범대학 재학생 및 비사범계
            교직과정 이수 <strong>학부 재학생</strong> (팀당 최대 4인)
          </li>
          <li>
            <strong>다전공 구성</strong> — 최소 2개 이상의 서로 다른
            전공(학과)으로 구성
          </li>
          <li>
            <strong>주교과 지정</strong> — 연구·개발의 중심이 되는
            &lsquo;주교과(대표 교과)&rsquo; 1개 지정 필수
          </li>
        </Guide>

        <Guide title="연구반 이수 기준">
          <li>OT · 최종 발표회 참석 (팀 내 과반수 이상 참여 필수)</li>
          <li>연구 기간 중 3회 이상 모임 운영</li>
          <li>회의록과 수업 설계 자료(수업지도안 · 양식 제공) 제출</li>
        </Guide>

        <Guide title="주요 지원 사항 및 혜택">
          <li>
            <strong>팀 활동비</strong> — 회의비(식사·간식), 도서 구매, 생성형
            AI 유료 구독(최대 2개월).{' '}
            <strong>2인 팀 30만 원 / 3인 팀 40만 원 / 4인 팀 50만 원</strong>
          </li>
          <li>
            <strong>교육봉사 연계</strong> — 이수 팀 대상 지역사회 연계
            교육봉사 참여 기회
          </li>
          <li>
            <strong>우수팀 시상</strong> — 최종 발표회를 통해 우수팀 선발 및
            시상(장학금)
          </li>
        </Guide>

        <div className="mt-4 space-y-2">
          <Check
            id="q-qualify"
            checked={v.agreeQualify === 'y'}
            onChange={(b) => onChange('agreeQualify', b ? 'y' : '')}
          >
            위 <strong>팀 구성 요건</strong>(다전공 2개 이상, 학부 재학생 한정
            등)을 확인하였으며 조건을 충족합니다.
          </Check>
          <Check
            id="q-criteria"
            checked={v.agreeCriteria === 'y'}
            onChange={(b) => onChange('agreeCriteria', b ? 'y' : '')}
          >
            <strong>연구반 이수 기준</strong>을 확인하였습니다.
          </Check>
        </div>
      </section>

      {/* ── 2. 팀 정보 ───────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold">팀 정보</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          이 프로그램은 <strong>팀원이 각자 신청</strong>합니다. 팀장 한 분이
          팀 전체를 신청하는 것이 아니라, <strong>팀원 모두가 따로</strong>{' '}
          이 신청서를 내야 합니다.
        </p>

        <div className="mt-4 rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm leading-relaxed">
          <p className="font-bold text-status-revision">팀명을 적으실 때</p>
          <p className="mt-1 text-ink-muted">
            <strong>팀원 모두가 똑같은 팀명</strong>을 적어야 한 팀으로
            묶입니다. 띄어쓰기 하나만 달라도 다른 팀으로 보입니다 —
            팀원끼리 <strong>미리 정해 그대로</strong> 적어 주세요.
          </p>
        </div>

        <div className="mt-4">
          <Field
            label="팀명"
            name="teamName"
            required
            value={v.teamName ?? ''}
            onChange={(e) => onChange('teamName', e.target.value)}
          />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">
            팀에서의 역할 <span className="text-status-revision">*</span>
          </legend>
          <p className="mt-1 text-xs text-ink-subtle">
            <strong>팀장만</strong> 아래에서 연구·개발 계획을 함께 작성합니다.
            팀원은 여기까지만 쓰시면 됩니다.
          </p>
          <div className="mt-2 flex gap-2">
            {['팀장', '팀원'].map((r) => (
              <Pick
                key={r}
                name="role"
                label={r}
                on={v.role === r}
                onPick={() => onChange('role', r)}
              />
            ))}
          </div>
        </fieldset>
      </section>

      {/* ── 3. 연구 계획 — 팀장만 ────────────────────────── */}
      {isLeader && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-bold">AI 융합 수업 연구 및 개발 계획</h2>
          <p className="mt-1 text-sm text-ink-muted">
            아래 내용은 <strong>추후 변경할 수 있습니다.</strong> 지금은 대략의
            방향만 적어 주세요.
          </p>

          {/* 유형 안내표 — 원본 그림표를 글자표로 옮긴 것 (09-09 대조 완료).
              ⚠️ 열을 넷으로 늘리지 않았다. 「예시 활동」은 핵심 개념 아래에
                 작은 글씨로 붙인다 — 휴대폰에서 4열은 글자가 뭉개진다(D-24). */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-subtle text-left">
                  <th className="border border-line p-2 font-semibold">유형</th>
                  <th className="border border-line p-2 font-semibold">
                    핵심 개념 · 예시 활동
                  </th>
                  <th className="border border-line p-2 font-semibold">
                    전공 조합 예시
                  </th>
                </tr>
              </thead>
              <tbody>
                {TYPE_GUIDE.map(([name, concept, examples, majors]) => (
                  <tr key={name}>
                    <td className="border border-line p-2 align-top font-semibold">
                      {name}
                    </td>
                    <td className="border border-line p-2 align-top text-ink-muted">
                      {concept}
                      {name !== '기타' && (
                        <ul className="mt-1.5 space-y-0.5 text-ink-subtle">
                          {examples.map((ex) => (
                            <li key={ex}>· {ex}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="border border-line p-2 align-top text-ink-muted">
                      {majors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">
              연구·개발하고자 하는 융합 수업 유형{' '}
              <span className="text-status-revision">*</span>
            </legend>
            <div className="mt-2 space-y-2">
              {LESSON_TYPES.map((t) => (
                <Pick
                  key={t}
                  name="lessonType"
                  label={t}
                  block
                  on={v.lessonType === t}
                  onPick={() => onChange('lessonType', t)}
                />
              ))}
              <Pick
                name="lessonType"
                label="기타"
                block
                on={v.lessonType === '기타'}
                onPick={() => onChange('lessonType', '기타')}
              />
              {v.lessonType === '기타' && (
                <input
                  aria-label="기타 유형"
                  value={v.lessonTypeEtc ?? ''}
                  onChange={(e) => onChange('lessonTypeEtc', e.target.value)}
                  placeholder="어떤 유형인지 적어 주세요"
                  className="w-full rounded-lg border border-line-strong bg-surface p-2.5 text-sm outline-none focus:border-brand-600"
                />
              )}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">
              개발할 수업의 대상 학교급{' '}
              <span className="text-status-revision">*</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCHOOL_LEVELS.map((l) => (
                <Pick
                  key={l}
                  name="schoolLevel"
                  label={l}
                  on={v.schoolLevel === l}
                  onPick={() => onChange('schoolLevel', l)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">
              주교과 및 연계 융합교과{' '}
              <span className="text-status-revision">*</span>
            </legend>
            <p className="mt-1 text-xs text-ink-subtle">
              해당하는 것을 <strong>모두</strong> 고르세요.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <Pick
                  key={s}
                  label={s}
                  box
                  on={(v.subjects ?? '').split(',').includes(s)}
                  onPick={() => toggleSubject(s)}
                />
              ))}
            </div>
            <input
              aria-label="기타 교과"
              value={v.subjectsEtc ?? ''}
              onChange={(e) => onChange('subjectsEtc', e.target.value)}
              placeholder="그 밖의 교과가 있으면 적어 주세요 (선택)"
              className="mt-2 w-full rounded-lg border border-line-strong bg-surface p-2.5 text-sm outline-none focus:border-brand-600"
            />
          </fieldset>

          <div className="mt-5">
            <Field
              label="주교과(대표 교과)"
              name="mainSubject"
              required
              hint="위에서 고른 교과 중 연구·개발의 중심이 되는 교과 1개"
              value={v.mainSubject ?? ''}
              onChange={(e) => onChange('mainSubject', e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="topic" className="block text-sm font-semibold">
              다뤄보고 싶은 수업 주제나 실생활 문제{' '}
              <span className="text-status-revision">*</span>
            </label>
            <textarea
              id="topic"
              rows={4}
              value={v.topic ?? ''}
              onChange={(e) => onChange('topic', e.target.value)}
              placeholder="간단히 적어 주세요. 나중에 바꾸실 수 있습니다."
              className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
            />
          </div>
        </section>
      )}

      {/* ── 4. 일정 확인 ─────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold">연구반 주요 일정</h2>

        <ol className="mt-3 space-y-2">
          {SCHEDULE.map(([n, when, what]) => (
            <li key={n} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-600 dark:text-brand-300">
                {n}
              </span>
              <span>
                <strong>{when}</strong>
                <span className="ml-2 text-ink-muted">{what}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-4">
          <Check
            id="q-schedule"
            checked={v.agreeSchedule === 'y'}
            onChange={(b) => onChange('agreeSchedule', b ? 'y' : '')}
          >
            위 일정을 확인하였습니다.
          </Check>
        </div>
      </section>
    </div>
  )
}

/* ── 작은 조각들 ──────────────────────────────────────────── */

function Guide({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 rounded-xl bg-subtle p-4">
      <p className="text-sm font-bold">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-muted">
        {children}
      </ul>
    </div>
  )
}

function Check({
  id,
  checked,
  onChange,
  children,
}: {
  id: string
  checked: boolean
  onChange: (b: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className={
        'flex cursor-pointer gap-3 rounded-xl border p-3 text-sm leading-relaxed ' +
        (checked ? 'border-brand-600 bg-brand-soft' : 'border-line-strong')
      }
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-brand-600"
      />
      <span>{children}</span>
    </label>
  )
}

/** 라디오·체크박스 겸용 버튼. `box` 면 여러 개를 고를 수 있는 모양 */
function Pick({
  name,
  label,
  on,
  onPick,
  block,
  box,
}: {
  name?: string
  label: string
  on: boolean
  onPick: () => void
  block?: boolean
  box?: boolean
}) {
  return (
    <label
      className={
        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm leading-snug ' +
        (block ? 'w-full ' : '') +
        (on
          ? 'border-brand-600 bg-brand-soft font-semibold'
          : 'border-line-strong text-ink-muted')
      }
    >
      <input
        type={box ? 'checkbox' : 'radio'}
        name={name}
        checked={on}
        onChange={onPick}
        className="size-4 shrink-0 accent-brand-600"
      />
      {label}
    </label>
  )
}
