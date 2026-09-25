'use client'

/**
 * 담당자가 신청서 칸을 목록으로 만드는 화면 (D-99).
 *
 * `app/staff/programs/page.tsx` 가 이미 1000줄이 넘어 그 안에서 더 키우지 않는다.
 * 규칙(무엇이 문제인가·무엇을 저장하는가)은 이 파일에 두지 않는다 —
 * **`lib/forms/fields.ts` 한 곳**이고, 여기는 그리기와 누르기만 한다.
 *
 * ── 왜 드래그가 아니라 ↑/↓ 인가 ──────────────────────────────
 * 저장소에 순서 변경 UI 가 없고 dnd 라이브러리도 설치돼 있지 않다. ↑/↓ 는
 * 휴대폰·키보드·스크린리더에서 전부 되지만 드래그는 셋 다 안 된다(D-24).
 *
 * ── 왜 삭제 확인창이 없나 ────────────────────────────────────
 * 저장 전이면 [취소]로 되돌아가고, 저장한 뒤여도 **이미 낸 신청서의 답은
 * `formData` 에 라벨과 함께 박혀 있어 사라지지 않는다**(D-50 의 목적).
 * 그 사실을 목록 아래에 한 줄로 알린다.
 */

import { FIELD_KIND_LABEL, type ProgramField, type ProgramFieldKind } from '@/lib/types'
import { MAX_FIELDS, fieldTitle, optionsOf } from '@/lib/forms/fields'

/** 담당자 폼과 같은 입력칸 모양 — page.tsx 의 것을 일부러 복사했다.
 *  두 곳뿐이라 아직 묶지 않는다(셋째가 생기면 그때 — D-50 주석의 판단). */
function inputCls(error?: string): string {
  return (
    'touch-target mt-1 w-full rounded-lg border bg-surface px-3 text-base ' +
    (error ? 'border-status-revision' : 'border-line-strong')
  )
}

const ADDABLE: ProgramFieldKind[] = ['text', 'attachment', 'consent', 'choice']

const HINT: Record<ProgramFieldKind, string> = {
  text: '신청자가 글을 쓰는 칸입니다.',
  attachment: '신청자가 파일을 올리는 칸입니다. 공고당 하나만 둘 수 있습니다.',
  consent: '신청자가 읽고 「확인하였습니다」에 체크하는 글입니다. 유의사항·수료 기준처럼 「읽었다」를 받을 때.',
  choice: '신청자가 두 갈래 중 하나를 고릅니다. 「동의 / 비동의」처럼 거부도 남겨야 할 때 쓰세요.',
}

/** 고르기 선택지의 예 — 담당자가 무엇을 적는 칸인지 바로 알게 한다 */
const OPTION_EG: [string, string] = ['동의함', '동의하지 않음']

export default function ProgramFieldRows({
  rows,
  errors,
  onChange,
  onAdd,
  onMove,
  onRemove,
  isGroup,
  teamNameExpected,
}: {
  rows: ProgramField[]
  errors: Record<string, string | undefined>
  onChange: (fid: string, patch: Partial<ProgramField>) => void
  onAdd: (kind: ProgramFieldKind) => void
  onMove: (fid: string, dir: -1 | 1) => void
  onRemove: (fid: string) => void
  /** 단체 프로그램이면 글 상자에 「이 칸이 팀명입니다」가 나온다 (D-105) */
  isGroup: boolean
  /** 팀원이 각자 신청 + 기본 신청서 — 팀명 칸이 **있어야** 산출물이 팀으로 묶인다 */
  teamNameExpected: boolean
}) {
  const hasAttachment = rows.some((f) => f.kind === 'attachment')
  const full = rows.length >= MAX_FIELDS
  const hasTeamName = rows.some((f) => f.kind === 'text' && f.isTeamName)

  /** 하나를 켜면 나머지를 끈다 — 팀명은 공고당 하나다 */
  const pickTeamName = (fid: string, on: boolean) => {
    if (on) {
      for (const r of rows) {
        if (r.fid !== fid && r.isTeamName) onChange(r.fid, { isTeamName: false })
      }
    }
    onChange(fid, { isTeamName: on })
  }

  return (
    <div className="space-y-3">
      {/* 🔴 막지는 않고 알린다 — 접수 중 급한 오타 수정까지 막으면 안 된다.
          다만 이걸 놓치면 산출물이 팀으로 안 묶이고, 그 사실을 **아무도 모른다**
          (D-104 가 찾기 전까지 실제로 그랬다). 그래서 칸 목록 **맨 위**에 둔다. */}
      {teamNameExpected && !hasTeamName && (
        <p className="rounded-lg border-l-4 border-warn bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn-ink">
          <strong>팀명 칸이 지정되지 않았습니다.</strong> 팀원이 각자 신청하는 공고는
          팀명으로 팀을 묶습니다 — 지정하지 않으면 <strong>산출물이 팀으로 묶이지
          않습니다.</strong> 「+ 글 상자」로 팀명 칸을 만들고{' '}
          <strong>「이 칸이 팀명입니다」</strong>를 체크해 주세요.
        </p>
      )}
      {rows.map((f, i) => {
        const err = errors[`row-${f.fid}`]
        const isText = f.kind === 'text'
        const isConsent = f.kind === 'consent'
        const isChoice = f.kind === 'choice'
        /**
         * 🔴 **편집 중에는 다듬지 않은 값을 쓴다.** `optionsOf` 는 `trim` 하므로
         *    입력칸의 value 로 쓰면 **끝에 띄어쓰기를 치는 순간 지워진다** —
         *    「동의하지 않음」의 공백을 넘어갈 수 없다(09-25 iSERI 발견).
         *    다듬기는 저장할 때(`cleanFields`)와 검사할 때(`fieldProblems`)만.
         */
        const opts: [string, string] = [f.options?.[0] ?? '', f.options?.[1] ?? '']
        return (
          <div
            key={f.fid}
            className={
              'rounded-xl border bg-surface p-4 ' +
              (err ? 'border-status-revision' : 'border-line-strong')
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                <span className="text-ink-subtle">{i + 1}</span>{' '}
                {FIELD_KIND_LABEL[f.kind]}
              </p>
              <div className="flex items-center gap-1">
                <Small
                  label="위로"
                  sign="↑"
                  disabled={i === 0}
                  onClick={() => onMove(f.fid, -1)}
                />
                <Small
                  label="아래로"
                  sign="↓"
                  disabled={i === rows.length - 1}
                  onClick={() => onMove(f.fid, 1)}
                />
                <button
                  type="button"
                  onClick={() => onRemove(f.fid)}
                  className="touch-target rounded-lg px-3 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-status-revision"
                >
                  지우기
                </button>
              </div>
            </div>

            <p className="mt-0.5 text-xs text-ink-subtle">{HINT[f.kind]}</p>

            {/* 첨부는 제목이 「첨부 서류」로 고정 — 이름을 묻지 않는다 */}
            {f.kind !== 'attachment' && (
              <label className="mt-3 block text-sm">
                <span className="font-semibold">칸 이름</span>
                <input
                  id={`pf-row-${f.fid}`}
                  value={f.label ?? ''}
                  onChange={(e) => onChange(f.fid, { label: e.target.value })}
                  placeholder={
                    isConsent ? '참가 유의사항' : isChoice ? '팀에서의 역할' : '활동 계획'
                  }
                  className={inputCls(err)}
                />
              </label>
            )}

            <label className="mt-3 block text-sm">
              <span className="font-semibold">
                {isConsent
                  ? '신청자가 읽을 본문'
                  : isChoice
                    ? '고르기 전에 읽을 글 (선택)'
                    : isText
                      ? '안내 (선택)'
                      : '안내 문구'}
              </span>
              <textarea
                id={f.kind === 'attachment' ? `pf-row-${f.fid}` : undefined}
                rows={isConsent ? 5 : isChoice ? 3 : 2}
                value={f.body ?? ''}
                onChange={(e) => onChange(f.fid, { body: e.target.value })}
                placeholder={
                  isConsent
                    ? '중도 포기 시 처리, 참석 의무처럼 나중에 근거가 되는 내용'
                    : isChoice
                      ? '무엇을 고르는 것인지, 고르면 어떻게 되는지'
                      : f.kind === 'attachment'
                        ? '1차시 수업설계안을 PDF 로 올려 주세요.'
                        : '무엇을 어떻게 적어야 하는지'
                }
                className={inputCls(f.kind === 'attachment' ? err : undefined)}
              />
            </label>

            {isText && (
              <fieldset className="mt-3">
                <legend className="text-sm font-semibold">답 쓰는 칸</legend>
                <div className="mt-1 flex gap-2">
                  <Pick
                    name={`ml-${f.fid}`}
                    label="한 줄"
                    on={!f.multiline}
                    onPick={() => onChange(f.fid, { multiline: false })}
                  />
                  <Pick
                    name={`ml-${f.fid}`}
                    label="여러 줄"
                    on={Boolean(f.multiline)}
                    onPick={() => onChange(f.fid, { multiline: true })}
                  />
                </div>
              </fieldset>
            )}

            {isText && isGroup && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(f.isTeamName)}
                  onChange={(e) => pickTeamName(f.fid, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-brand-600"
                />
                <span>
                  <span className="font-semibold">이 칸이 팀명입니다</span>
                  <span className="block text-xs text-ink-subtle">
                    산출물을 팀으로 묶을 때 이 칸의 답을 씁니다. 공고당 하나만.
                  </span>
                </span>
              </label>
            )}

            {isChoice && (
              <fieldset className="mt-3">
                <legend className="text-sm font-semibold">고를 것 (두 개)</legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {([0, 1] as const).map((n) => (
                    <input
                      key={n}
                      aria-label={`고를 것 ${n + 1}`}
                      value={opts[n]}
                      onChange={(e) => {
                        const next: [string, string] = [opts[0], opts[1]]
                        next[n] = e.target.value
                        onChange(f.fid, { options: next })
                      }}
                      placeholder={OPTION_EG[n]}
                      className={inputCls(err)}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-subtle">
                  신청자에게 <strong>버튼 두 개</strong>로 보입니다. 적으신 글자가
                  그대로 답으로 저장됩니다.
                </p>
              </fieldset>
            )}

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(f.required)}
                onChange={(e) => onChange(f.fid, { required: e.target.checked })}
                className="size-4 accent-brand-600"
              />
              <span className="font-semibold">
                {isConsent
                  ? '체크해야 제출할 수 있게'
                  : isChoice
                    ? '골라야 제출할 수 있게'
                    : '이 칸을 필수로'}
              </span>
            </label>

            {/* 🔴 여기서 막지 않으면 「안 고름」이 무슨 뜻인지 아무도 모른다 */}
            {isChoice && !f.required && (
              <p className="mt-2 rounded-lg border-l-4 border-warn bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn-ink">
                필수를 끄면 <strong>안 고르고도 제출할 수 있습니다.</strong> 그러면
                신청 내역에 그 줄이 아예 없어서, 담당자는 <strong>거부한 것인지 그냥
                지나친 것인지 알 수 없습니다.</strong> 「
                {optionsOf(f)[1] || '동의하지 않음'}」 같은 선택지를 두셨다면{' '}
                <strong>필수로 두는 쪽</strong>을 권합니다.
              </p>
            )}

            {err && (
              <p className="mt-2 text-xs font-semibold text-status-revision">{err}</p>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2">
        {ADDABLE.map((k) => {
          const blocked =
            full || (k === 'attachment' && hasAttachment) ? true : false
          return (
            <button
              key={k}
              type="button"
              disabled={blocked}
              onClick={() => onAdd(k)}
              className={
                'touch-target rounded-lg border px-4 text-sm font-semibold ' +
                (blocked
                  ? 'cursor-not-allowed border-line text-ink-subtle'
                  : 'border-line-strong hover:bg-subtle')
              }
            >
              + {FIELD_KIND_LABEL[k]}
            </button>
          )
        })}
      </div>

      {hasAttachment && (
        <p className="text-xs text-ink-subtle">
          첨부 칸은 <strong>하나만</strong> 둘 수 있습니다 — 한 칸에 파일 5개까지
          올릴 수 있습니다.
        </p>
      )}
      {full && (
        <p className="text-xs text-ink-subtle">칸은 {MAX_FIELDS}개까지입니다.</p>
      )}

      {rows.length > 0 && (
        <p className="text-xs leading-relaxed text-ink-subtle">
          지운 칸의 답은 <strong>이미 제출된 신청서에 그대로 남습니다.</strong>{' '}
          앞으로 신청하는 사람에게만 안 보입니다.
        </p>
      )}

      {/* 기대를 여기서 잘라 둔다 — 선(D-100)이 어디까지인지 담당자가 알아야 한다 */}
      <p className="text-xs leading-relaxed text-ink-subtle">
        고르기는 <strong>두 갈래까지</strong>입니다. 셋 이상 고르기, 「이걸 고르면
        저게 나오기」, 숫자·날짜 형식 검사는 <strong>여기서 만들 수 없습니다.</strong>{' '}
        그런 신청서가 필요하면 개발자에게 말씀해 주세요.
      </p>
    </div>
  )
}

function Small({
  label,
  sign,
  disabled,
  onClick,
}: {
  label: string
  sign: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        'touch-target rounded-lg border px-3 text-sm ' +
        (disabled
          ? 'cursor-not-allowed border-line text-ink-subtle'
          : 'border-line-strong hover:bg-subtle')
      }
    >
      <span aria-hidden>{sign}</span>
    </button>
  )
}

function Pick({
  name,
  label,
  on,
  onPick,
}: {
  name: string
  label: string
  on: boolean
  onPick: () => void
}) {
  return (
    <label
      className={
        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ' +
        (on
          ? 'border-brand-600 bg-brand-soft font-semibold'
          : 'border-line-strong text-ink-muted')
      }
    >
      <input
        type="radio"
        name={name}
        checked={on}
        onChange={onPick}
        className="size-4 accent-brand-600"
      />
      {label}
    </label>
  )
}
