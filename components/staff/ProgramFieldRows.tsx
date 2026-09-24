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
import { MAX_FIELDS, fieldTitle } from '@/lib/forms/fields'

/** 담당자 폼과 같은 입력칸 모양 — page.tsx 의 것을 일부러 복사했다.
 *  두 곳뿐이라 아직 묶지 않는다(셋째가 생기면 그때 — D-50 주석의 판단). */
function inputCls(error?: string): string {
  return (
    'touch-target mt-1 w-full rounded-lg border bg-surface px-3 text-base ' +
    (error ? 'border-status-revision' : 'border-line-strong')
  )
}

const ADDABLE: ProgramFieldKind[] = ['text', 'attachment', 'consent']

const HINT: Record<ProgramFieldKind, string> = {
  text: '신청자가 글을 쓰는 칸입니다.',
  attachment: '신청자가 파일을 올리는 칸입니다. 공고당 하나만 둘 수 있습니다.',
  consent: '신청자가 읽고 「확인하였습니다」에 체크하는 글입니다.',
}

export default function ProgramFieldRows({
  rows,
  errors,
  onChange,
  onAdd,
  onMove,
  onRemove,
}: {
  rows: ProgramField[]
  errors: Record<string, string | undefined>
  onChange: (fid: string, patch: Partial<ProgramField>) => void
  onAdd: (kind: ProgramFieldKind) => void
  onMove: (fid: string, dir: -1 | 1) => void
  onRemove: (fid: string) => void
}) {
  const hasAttachment = rows.some((f) => f.kind === 'attachment')
  const full = rows.length >= MAX_FIELDS

  return (
    <div className="space-y-3">
      {rows.map((f, i) => {
        const err = errors[`row-${f.fid}`]
        const isText = f.kind === 'text'
        const isConsent = f.kind === 'consent'
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
                  placeholder={isConsent ? '참가 유의사항' : '활동 계획'}
                  className={inputCls(err)}
                />
              </label>
            )}

            <label className="mt-3 block text-sm">
              <span className="font-semibold">
                {isConsent ? '신청자가 읽을 본문' : isText ? '안내 (선택)' : '안내 문구'}
              </span>
              <textarea
                id={f.kind === 'attachment' ? `pf-row-${f.fid}` : undefined}
                rows={isConsent ? 5 : 2}
                value={f.body ?? ''}
                onChange={(e) => onChange(f.fid, { body: e.target.value })}
                placeholder={
                  isConsent
                    ? '중도 포기 시 처리, 참석 의무처럼 나중에 근거가 되는 내용'
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

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(f.required)}
                onChange={(e) => onChange(f.fid, { required: e.target.checked })}
                className="size-4 accent-brand-600"
              />
              <span className="font-semibold">
                {isConsent ? '체크해야 제출할 수 있게' : '이 칸을 필수로'}
              </span>
            </label>

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

      {/* 기대를 여기서 잘라 둔다 — 없으면 "선택지도 되나요"가 반드시 온다 */}
      <p className="text-xs leading-relaxed text-ink-subtle">
        고르는 항목(라디오·체크박스 목록), 「이걸 고르면 저게 나오기」, 숫자·날짜
        형식 검사는 <strong>여기서 만들 수 없습니다.</strong> 그런 신청서가
        필요하면 개발자에게 말씀해 주세요 — 프로그램 전용 양식으로 만듭니다.
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
