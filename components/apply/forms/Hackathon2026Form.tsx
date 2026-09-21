'use client'

/**
 * AI-EDU Next Class — 예비교원 AI 융합 수업설계 해커톤 (2026) 전용 신청 양식.
 * 교수님이 주신 한글 양식(`(신청서 양식) AI-EDU Next Class 참가 신청서`)을 옮긴 것.
 *
 * ── 원본과 다르게 한 것 (전부 09-22 iSERI 결정) ──────────────
 * ① **서명란·작성일을 뺐다.** 웹에서 서명을 받을 방법이 아직 없어 교수님께
 *    여쭤 빼기로 했다. 작성일은 제출 시각이 자동으로 남아 따로 받지 않는다.
 * ② **「팀원 1 / 팀원 2」 칸을 만들지 않았다.** 원본은 대표자가 두 사람 몫을
 *    적게 되어 있으나, 이 사이트는 AI-EDU 와 같이 **팀원이 각자 신청하고
 *    팀명으로 묶는다** — 대리 수집이 없고 1인 1건 중복 방지와도 맞는다.
 * ③ **성명·소속대학·학과·전공·연락처·이메일을 묻지 않는다.** 전부 회원 정보
 *    (`SupportUser` 의 `name`·`affiliation`·`major`·`phone`·`email`)에 이미
 *    있고 신청서 위쪽 「신청자 정보」에 그대로 나온다. 또 물으면 두 값이
 *    갈라지고, 어느 쪽이 맞는지 담당자가 알 수 없게 된다.
 *    → 원본 칸 중 회원 정보에 없는 것은 **「구분」 하나뿐**이라 그것만 받는다.
 * ④ **1차시 수업설계안(PDF)은 이 양식이 아니라 기본 첨부로 받는다.**
 *    공고 등록 때 「첨부 필수」를 켜면 신청서 아래에 첨부란이 생긴다.
 *    양식이 파일을 따로 다루면 첨부 경로가 둘이 되어 D-73 수정 흐름이 깨진다.
 * ⑤ **개인정보 수집·이용 동의를 받지 않는다.** 원본에 체크란이 있지만 그건
 *    종이가 혼자 서 있기 때문이다. 이 사이트는 **가입 때 한 번** 받아
 *    문구 버전·시각까지 남기고(`SupportUser.consents`), 신청서 위 「신청자
 *    정보」에 「O (동의)」로 **확인만** 한다. 여기서 또 물으면 위아래가
 *    모순되고, 이미 동의한 사람이 체크를 빠뜨리면 제출이 막힌다.
 *    신청 단계에서 다시 받는 동의는 **초상권뿐**이다 (D-44).
 *
 * ── 트랙·과제 ────────────────────────────────────────────
 * 과제는 **고른 트랙의 것만** 보인다. 트랙을 바꾸면 고른 과제를 지운다 —
 * 남겨 두면 화면에 안 보이는 값이 그대로 제출된다(보이지 않는 것은 못 고친다).
 *
 * ── 팀 대표자만 쓰는 것 ──────────────────────────────────
 * 트랙·과제·학교급·교과·제출 서류는 **팀이 하나로 내는 것**이라 대표자만
 * 작성한다(AI-EDU 의 팀장 방식과 같다). 두 사람이 각각 다른 과제를 적으면
 * 어느 것이 팀의 지원 과제인지 알 수 없다.
 *
 * 🔴 **「참가 유의사항」 문구가 아직 없다** — 교수님께 여쭙는 중
 *    (`docs/3-할일/03-교수님께-여쭐-것-한장.md` ⑥). 문구가 오면 아래
 *    NOTICE_TEXT 를 채우고 동의 체크를 살린다.
 */

import Field from '@/components/ui/Field'

/** 프로그램 문서의 `formType` 에 넣는 값 */
export const HACKATHON_2026 = 'hackathon-2026'

type Values = Record<string, string>

/* ── 선택지 ───────────────────────────────────────────────── */

const TRACKS = [
  { id: 'T1', label: 'Track 1 — 도전형 문제 해결' },
  { id: 'T2', label: 'Track 2 — 교육과정 개발형' },
] as const

/** 과제 — `track` 이 같은 것만 화면에 보인다 */
const TASKS = [
  { id: 'T1-1', track: 'T1', label: 'T1-1 AI 과의존 문제 해결' },
  { id: 'T1-2', track: 'T1', label: 'T1-2 제한된 환경에서의 AI 문제해결 수업 설계' },
  { id: 'T1-3', track: 'T1', label: 'T1-3 학생 간 AI·학습 격차 해소' },
  { id: 'T2-1', track: 'T2', label: 'T2-1 교과 연계 AI 융합수업 개발' },
  { id: 'T2-2', track: 'T2', label: 'T2-2 디지털 윤리·저작권 교육 개발' },
] as const

const SCHOOL_LEVELS = ['중학교', '고등학교'] as const

/** 원본의 「구분」 — 회원 정보에 없는 유일한 칸이라 여기서 받는다 */
const QUALIFY_TYPES = ['사범대학 재학', '일반대학 교직이수과정'] as const

const ROLES = ['팀 대표자', '팀원'] as const

/** 글자 수 상한 — 원본 양식의 「500자 이내」·「300자 이내」 */
export const REASON_MAX = 500
export const MOTIVE_MAX = 300

/**
 * 🔴 참가 유의사항 본문 — 교수님 답을 받으면 채운다.
 * 비어 있는 동안에는 동의 체크를 **띄우지 않는다**: 내용 없는 체크를 받아 두면
 * 나중에 중도 포기 건이 생겼을 때 "무엇에 동의한 것인지" 근거가 없다.
 */
const NOTICE_TEXT = ''

/* ── 저장 형태로 바꾸기 ───────────────────────────────────── */

/** 고른 과제의 보이는 이름 — 저장에는 'T1-1' 이 아니라 제목까지 남긴다 */
function taskLabel(id?: string): string {
  return TASKS.find((t) => t.id === id)?.label ?? ''
}

function trackLabel(id?: string): string {
  return TRACKS.find((t) => t.id === id)?.label ?? ''
}

/**
 * 화면 값 → 신청서에 저장할 `{라벨, 값}` 목록.
 *
 * ⚠️ **라벨을 함께 저장한다.** 키만 남기면 나중에 이 파일을 고쳤을 때
 *    옛 신청서가 무슨 질문에 답한 것인지 알 수 없게 된다 (D-50 주석 참고).
 */
export function toRows(v: Values): { label: string; value: string }[] {
  const isLeader = v.role === '팀 대표자'
  const rows: { label: string; value: string }[] = [
    { label: '팀명', value: v.teamName ?? '' },
    { label: '팀에서의 역할', value: v.role ?? '' },
    { label: '구분', value: v.qualifyType ?? '' },
  ]

  // 팀원은 트랙·과제·제출 서류를 쓰지 않는다 — 팀이 하나로 내는 것이라
  // 대표자가 한 번만 낸다. 안 물어본 항목은 줄 자체를 만들지 않는다(D-43).
  if (isLeader) {
    rows.push(
      { label: '지원 트랙', value: trackLabel(v.track) },
      { label: '지원 과제', value: taskLabel(v.task) },
      { label: '적용 학교급', value: v.schoolLevel ?? '' },
      { label: '적용 교과', value: v.subject ?? '' },
      { label: '이 트랙과 과제를 선택한 이유', value: v.reason ?? '' },
      { label: '지원 동기', value: v.motive ?? '' }
    )
  }

  if (NOTICE_TEXT) {
    rows.push({
      label: '참가 유의사항 확인',
      value: v.agreeNotice === 'y' ? '확인함' : '',
    })
  }

  return rows
}

/* ── 검증 ─────────────────────────────────────────────────── */

/** 문제가 있으면 안내 문구, 없으면 null */
export function validate(v: Values): string | null {
  if (!v.teamName?.trim()) return '팀명을 입력해 주세요.'
  if (!v.role) return '팀에서의 역할을 선택해 주세요.'
  if (!v.qualifyType) return '구분(사범대학 재학 / 교직이수과정)을 선택해 주세요.'

  if (v.role === '팀 대표자') {
    if (!v.track) return '지원 트랙을 선택해 주세요.'
    if (!v.task) return '지원 과제를 선택해 주세요.'
    if (!v.schoolLevel) return '적용 학교급을 선택해 주세요.'
    if (!v.subject?.trim()) return '적용 교과를 적어 주세요.'

    // 고른 과제가 고른 트랙의 것인지. 화면은 트랙을 바꿀 때 과제를 지우므로
    // 보통은 걸리지 않지만, 마감 전 수정(D-73)으로 옛 값이 되살아나는 길이
    // 있어 마지막에 한 번 더 본다.
    if (TASKS.find((t) => t.id === v.task)?.track !== v.track) {
      return '고르신 트랙의 과제가 아닙니다. 지원 과제를 다시 골라 주세요.'
    }

    // ⚠️ **빈 칸은 trim, 길이는 원문 그대로** 센다 — 길이를 trim 해서 재면
    //    화면 오른쪽 아래 숫자(원문 기준)와 어긋나, 신청자는 「500 / 500」을
    //    보면서 "줄여 달라"는 말을 듣게 된다. 보이는 수와 막는 수는 같아야 한다.
    // 글자 수 초과는 **칸 아래에 바로 뜬다**(`Counted`). 여기 문구는 제출을
    // 멈추며 **어느 칸인지**만 알린다 — 같은 문장을 두 곳에 띄우지 않는다.
    if (!v.reason?.trim()) return '이 트랙과 과제를 선택한 이유를 적어 주세요.'
    if ((v.reason ?? '').length > REASON_MAX) {
      return `「이 트랙과 과제를 선택한 이유」가 ${REASON_MAX}자를 넘었습니다.`
    }

    if (!v.motive?.trim()) return '지원 동기를 적어 주세요.'
    if ((v.motive ?? '').length > MOTIVE_MAX) {
      return `「지원 동기」가 ${MOTIVE_MAX}자를 넘었습니다.`
    }
  }

  if (NOTICE_TEXT && v.agreeNotice !== 'y') return '참가 유의사항을 확인해 주세요.'
  return null
}

/* ── 화면 ─────────────────────────────────────────────────── */

export default function Hackathon2026Form({
  value: v,
  onChange,
}: {
  value: Values
  onChange: (key: string, val: string) => void
}) {
  const isLeader = v.role === '팀 대표자'

  /** 트랙을 바꾸면 고른 과제를 지운다 — 안 보이는 값이 제출되면 못 고친다 */
  const pickTrack = (id: string) => {
    onChange('track', id)
    if (TASKS.find((t) => t.id === v.task)?.track !== id) onChange('task', '')
  }

  return (
    <div className="space-y-6">
      {/* ── 1. 참가 안내 ─────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
        <h2 className="font-bold">참가 안내</h2>

        <Guide title="참가 방식">
          <li>
            <strong>2인 1팀</strong>으로 참가합니다
          </li>
          <li>
            <strong>Track 1</strong>(도전형 문제 해결) 또는{' '}
            <strong>Track 2</strong>(교육과정 개발형) 중 하나를 고른 뒤, 그
            트랙의 <strong>과제 1개</strong>를 확정해 지원합니다
          </li>
          <li>
            고른 과제에 대한 <strong>1차시 수업설계안</strong>(지정 템플릿,
            PDF)을 <strong>이 신청서 아래 첨부란</strong>에 함께 올립니다
          </li>
        </Guide>

        <fieldset className="mt-4" data-field-required="true">
          <legend className="text-sm font-semibold">
            구분 <span className="text-status-revision">*</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUALIFY_TYPES.map((q) => (
              <Pick
                key={q}
                name="qualifyType"
                label={q}
                on={v.qualifyType === q}
                onPick={() => onChange('qualifyType', q)}
              />
            ))}
          </div>
        </fieldset>
      </section>

      {/* ── 2. 팀 정보 ───────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
        <h2 className="font-bold">팀 정보</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          이 프로그램은 <strong>팀원이 각자 신청</strong>합니다. 대표자 한 분이
          팀 전체를 신청하는 것이 아니라, <strong>두 사람 모두 따로</strong>{' '}
          이 신청서를 내야 합니다.
        </p>

        <div className="mt-4 rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm leading-relaxed">
          <p className="font-bold text-status-revision">팀명을 적으실 때</p>
          <p className="mt-1 text-ink-muted">
            <strong>두 사람이 똑같은 팀명</strong>을 적어야 한 팀으로 묶입니다.
            띄어쓰기 하나만 달라도 다른 팀으로 보입니다 — 팀원끼리{' '}
            <strong>미리 정해 그대로</strong> 적어 주세요.
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

        <fieldset className="mt-4" data-field-required="true">
          <legend className="text-sm font-semibold">
            팀에서의 역할 <span className="text-status-revision">*</span>
          </legend>
          <p className="mt-1 text-xs text-ink-subtle">
            <strong>대표자만</strong> 아래에서 지원 트랙·과제와 제출 서류를
            작성합니다. 팀원은 여기까지만 쓰시면 됩니다.
          </p>
          <div className="mt-2 flex gap-2">
            {ROLES.map((r) => (
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

      {/* ── 3. 지원 트랙 및 과제 — 대표자만 ──────────────── */}
      {isLeader && (
        <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
          <h2 className="font-bold">지원 트랙 및 과제</h2>

          <fieldset className="mt-4" data-field-required="true">
            <legend className="text-sm font-semibold">
              지원 트랙 <span className="text-status-revision">*</span>
            </legend>
            <p className="mt-1 text-xs text-ink-subtle">하나만 고르세요.</p>
            <div className="mt-2 space-y-2">
              {TRACKS.map((t) => (
                <Pick
                  key={t.id}
                  name="track"
                  label={t.label}
                  block
                  on={v.track === t.id}
                  onPick={() => pickTrack(t.id)}
                />
              ))}
            </div>
          </fieldset>

          {v.track && (
            <fieldset className="mt-5" data-field-required="true">
              <legend className="text-sm font-semibold">
                지원 과제 <span className="text-status-revision">*</span>
              </legend>
              <p className="mt-1 text-xs text-ink-subtle">
                고르신 트랙의 과제 <strong>1개</strong>만 고르세요.
              </p>
              <div className="mt-2 space-y-2">
                {TASKS.filter((t) => t.track === v.track).map((t) => (
                  <Pick
                    key={t.id}
                    name="task"
                    label={t.label}
                    block
                    on={v.task === t.id}
                    onPick={() => onChange('task', t.id)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="mt-5" data-field-required="true">
            <legend className="text-sm font-semibold">
              적용 학교급 <span className="text-status-revision">*</span>
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

          <div className="mt-5">
            <Field
              label="적용 교과"
              name="subject"
              required
              hint="수업을 적용할 교과를 적어 주세요"
              value={v.subject ?? ''}
              onChange={(e) => onChange('subject', e.target.value)}
            />
          </div>
        </section>
      )}

      {/* ── 4. 예선 제출 서류 — 대표자만 ─────────────────── */}
      {isLeader && (
        <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
          <h2 className="font-bold">예선 제출 서류</h2>

          <Guide title="1차시 수업설계안">
            <li>
              지정 템플릿으로 작성해 <strong>PDF 1부</strong>를, 이 신청서{' '}
              <strong>아래 첨부란</strong>에 올려 주세요
            </li>
          </Guide>

          <Counted
            id="reason"
            label="이 트랙과 과제를 선택한 이유"
            max={REASON_MAX}
            rows={5}
            value={v.reason ?? ''}
            onChange={(s) => onChange('reason', s)}
          />

          <Counted
            id="motive"
            label="지원 동기"
            hint="예선 심사에 10점 반영됩니다."
            max={MOTIVE_MAX}
            rows={4}
            value={v.motive ?? ''}
            onChange={(s) => onChange('motive', s)}
          />
        </section>
      )}

      {/* ── 5. 참가 유의사항 ─────────────────────────────────
          **개인정보 수집·이용 동의는 여기서 받지 않는다.** 가입 때 이미 받아
          `SupportUser.consents` 에 문구 버전·시각까지 남아 있고, 신청서 위
          「신청자 정보」에 「O (동의)」로 확인된다. 여기서 또 물으면 ① 위아래가
          모순되고 ② 체크를 안 한 사람은 **이미 동의했는데도** 제출이 막히며
          ③ `formData` 에 「동의함」 글자만 남아 가입 기록보다 근거가 약해진다.
          신청 단계에서 다시 받는 것은 **초상권뿐**이다 (D-44 — 프로그램마다
          사진을 찍는지가 달라서). 그 동의는 기본 신청서가 아래에서 받는다.

          유의사항 문구가 오기 전에는 이 구획 자체를 띄우지 않는다 — 내용 없는
          동의는 나중에 근거가 되지 못한다 (교수님께 여쭐 것 ⑥). */}
      {NOTICE_TEXT && (
        <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
          <h2 className="font-bold">참가 유의사항</h2>
          <div className="mt-4 rounded-xl bg-subtle p-4 text-sm leading-relaxed text-ink-muted">
            {NOTICE_TEXT}
          </div>
          <div className="mt-2">
            <Check
              id="h-notice"
              checked={v.agreeNotice === 'y'}
              onChange={(b) => onChange('agreeNotice', b ? 'y' : '')}
            >
              위 <strong>참가 유의사항</strong>을 확인하였습니다.
            </Check>
          </div>
        </section>
      )}
    </div>
  )
}

/* ── 작은 조각들 ──────────────────────────────────────────── */
/* AiEdu2026Form 과 같은 모양이다. 양식이 셋째로 늘어나 공통점이 확실해지면
   그때 한곳으로 묶는다 — 둘일 때 묶으면 틀린 추상화가 된다(D-50 주석). */

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

/** 글자 수를 세어 보여 주는 여러 줄 입력 — 넘으면 숫자가 귤색으로 */
function Counted({
  id,
  label,
  hint,
  max,
  rows,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  max: number
  rows: number
  value: string
  onChange: (s: string) => void
}) {
  const over = value.length > max
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} <span className="text-status-revision">*</span>
      </label>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
      <textarea
        id={id}
        data-field-required="true"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
      />
      {/* 글자 수는 늘 오른쪽 아래에. 넘으면 **그 자리에서** 무엇을 해야 하는지
          알린다 — 제출 버튼까지 내려가야 알게 되면 어느 칸인지 모른다 */}
      <div className="mt-1 flex items-start justify-between gap-3">
        <p
          role={over ? 'alert' : undefined}
          className={
            'text-xs leading-relaxed text-warn-ink ' + (over ? '' : 'invisible')
          }
        >
          {max}자 이내로 줄여 주세요.
        </p>
        <p
          className={
            'shrink-0 text-right text-xs ' +
            (over ? 'font-bold text-warn-ink' : 'text-ink-subtle')
          }
        >
          {value.length} / {max}
        </p>
      </div>
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
      data-field-required="true"
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
