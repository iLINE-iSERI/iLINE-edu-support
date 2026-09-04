'use client'

/**
 * 동의서 한 건 — 「동의함 / 동의하지 않음」 2지선다.
 *
 * 체크박스가 아니라 라디오인 이유: 종이 동의서 양식이 2지선다이고,
 * 무엇보다 **거부를 명시적으로 기록**해야 하기 때문이다.
 * 체크박스는 "안 누름"과 "거부"가 구분되지 않는다.
 */

import type { ReactNode } from 'react'

export default function ConsentBlock({
  id,
  title,
  required,
  value,
  onChange,
  children,
}: {
  id: string
  title: string
  required?: boolean
  /** null = 아직 선택하지 않음 */
  value: boolean | null
  onChange: (v: boolean) => void
  /** 동의 내용 본문 */
  children: ReactNode
}) {
  return (
    <fieldset className="rounded-xl border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-bold">
        {title}
        <span
          className={
            'ml-1.5 rounded px-1.5 py-0.5 text-xs font-semibold ' +
            (required
              ? 'bg-status-revision/15 text-status-revision'
              : 'bg-subtle text-ink-subtle')
          }
        >
          {required ? '필수' : '선택'}
        </span>
      </legend>

      <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-ink-muted">
        {children}
      </div>

      <div className="mt-4 flex gap-2">
        <label
          className={
            'flex flex-1 cursor-pointer touch-target items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors ' +
            (value === true
              ? 'border-brand-600 bg-brand-soft text-brand-600 dark:text-brand-300'
              : 'border-line-strong text-ink-muted')
          }
        >
          <input
            type="radio"
            name={id}
            className="size-4 accent-brand-600"
            checked={value === true}
            onChange={() => onChange(true)}
          />
          동의함
        </label>

        <label
          className={
            'flex flex-1 cursor-pointer touch-target items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors ' +
            (value === false
              ? 'border-line-strong bg-subtle text-ink'
              : 'border-line-strong text-ink-muted')
          }
        >
          <input
            type="radio"
            name={id}
            className="size-4 accent-brand-600"
            checked={value === false}
            onChange={() => onChange(false)}
          />
          동의하지 않음
        </label>
      </div>
    </fieldset>
  )
}
