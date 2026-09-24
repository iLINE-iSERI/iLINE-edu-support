'use client'

/**
 * 담당자가 만든 신청서 칸을 신청자에게 그린다 (D-99).
 *
 * 규칙(무엇이 필수인가·무엇을 저장하는가)은 여기 없다 —
 * **`lib/forms/fields.ts` 한 곳**이고, 이 파일은 그리기만 한다.
 *
 * ⚠️ 각 입력칸에 **`data-field-required` / `data-field-filled` 를 반드시 단다.**
 *    `lib/ui/formSeek.ts` 가 id 목록 없이 **DOM 순서**로 돌기 때문에, 이 속성만
 *    붙이면 「신청서 작성하러 가기 ↓」가 동적으로 늘어난 줄까지 그대로 찾아간다.
 *
 * ⚠️ 첨부 칸의 **파일 고르기 UI 는 `ApplicationForm` 이 그린다**(`renderAttachment`).
 *    파일 상태(`files`·`rejected`)를 이 컴포넌트로 내리면 상태가 두 곳으로 갈린다.
 */

import type { ProgramField } from '@/lib/types'
import { fieldTitle, isAgreed } from '@/lib/forms/fields'

export default function ProgramFields({
  fields,
  values,
  onChange,
  isEdit,
  staleIds,
  renderAttachment,
}: {
  fields: ProgramField[]
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  isEdit: boolean
  /** 수정 중인데 **본문이 바뀐** 동의 칸 — 다시 물어야 한다 (D-98 결함 ②) */
  staleIds: Set<string>
  renderAttachment: (f: ProgramField) => React.ReactNode
}) {
  if (fields.length === 0) return null

  return (
    <>
      {fields.map((f) => {
        const title = fieldTitle(f)
        const star = f.required ? (
          <span className="ml-1 text-status-revision" aria-hidden="true">
            *
          </span>
        ) : null

        if (f.kind === 'attachment') {
          // 수정 모드에서는 첨부를 못 바꾼다 — 옛 첨부 칸과 같은 규칙
          if (isEdit) return null
          return (
            <section key={f.fid} className="card p-5">
              <h2 className="font-bold">
                {title}
                {star}
              </h2>
              {f.body && (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                  {f.body}
                </p>
              )}
              {renderAttachment(f)}
            </section>
          )
        }

        if (f.kind === 'consent') {
          const agreed = isAgreed(values, f)
          const mustAskAgain = isEdit && staleIds.has(f.fid)
          return (
            <section key={f.fid} className="card p-5">
              <h2 className="font-bold">
                {title}
                {star}
              </h2>

              {mustAskAgain && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg border-l-4 border-warn bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn-ink"
                >
                  {values[`${f.fid}.body`] === undefined
                    ? '제출 당시 확인하신 내용을 보관하지 못했습니다. 아래 내용을 다시 확인해 주세요.'
                    : '내용이 바뀌었습니다. 아래 내용을 다시 확인해 주세요.'}
                </p>
              )}

              <p className="mt-3 whitespace-pre-line break-keep rounded-xl bg-subtle p-4 text-sm leading-relaxed text-ink-muted">
                {f.body}
              </p>

              {isEdit && !mustAskAgain ? (
                <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-sm">
                  제출 당시 <strong>{agreed ? '확인함' : '확인하지 않음'}</strong>
                  <span className="text-ink-subtle"> — 수정할 수 없습니다</span>
                </p>
              ) : (
                <label
                  htmlFor={`fld-${f.fid}`}
                  data-field-required={f.required ? 'true' : undefined}
                  data-field-filled={agreed ? 'true' : 'false'}
                  className={
                    'mt-4 flex cursor-pointer gap-3 rounded-xl border p-3 text-sm leading-relaxed ' +
                    (agreed ? 'border-brand-600 bg-brand-soft' : 'border-line-strong')
                  }
                >
                  <input
                    id={`fld-${f.fid}`}
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => onChange(f.fid, e.target.checked ? 'y' : 'n')}
                    className="mt-0.5 size-4 shrink-0 accent-brand-600"
                  />
                  <span>
                    위 <strong>{title}</strong>을(를) 확인하였습니다.
                  </span>
                </label>
              )}
            </section>
          )
        }

        // 글 상자
        const val = values[f.fid] ?? ''
        return (
          <section key={f.fid} className="card p-5">
            <label htmlFor={`fld-${f.fid}`} className="block font-bold">
              {title}
              {star}
            </label>
            {f.body && (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                {f.body}
              </p>
            )}
            {f.multiline ? (
              <textarea
                id={`fld-${f.fid}`}
                data-field-required={f.required ? 'true' : undefined}
                rows={5}
                value={val}
                onChange={(e) => onChange(f.fid, e.target.value)}
                className="mt-3 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
              />
            ) : (
              <input
                id={`fld-${f.fid}`}
                data-field-required={f.required ? 'true' : undefined}
                value={val}
                onChange={(e) => onChange(f.fid, e.target.value)}
                className="touch-target mt-3 w-full rounded-lg border border-line-strong bg-surface px-3 text-base outline-none focus:border-brand-600"
              />
            )}
          </section>
        )
      })}
    </>
  )
}
