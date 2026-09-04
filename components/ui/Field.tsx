/**
 * 폼 입력 공통 컴포넌트.
 * D-24: 모바일에서 라벨·오류가 잘리지 않고, 적절한 키패드가 뜨도록
 *       inputMode / autoComplete 를 넘길 수 있게 한다.
 */

import type { InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export default function Field({
  label,
  hint,
  error,
  id,
  required,
  ...rest
}: FieldProps) {
  const inputId = id || rest.name
  const describedBy = [
    hint ? `${inputId}-hint` : null,
    error ? `${inputId}-error` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {label}
        {required && (
          <span className="ml-1 text-status-revision" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">필수</span>}
      </label>

      {hint && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      )}

      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          'mt-2 block w-full rounded-xl border bg-surface px-3.5 py-3 text-ink placeholder:text-ink-subtle ' +
          (error ? 'border-status-revision' : 'border-line-strong')
        }
        {...rest}
      />

      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="mt-1.5 text-sm text-status-revision"
        >
          {error}
        </p>
      )}
    </div>
  )
}
