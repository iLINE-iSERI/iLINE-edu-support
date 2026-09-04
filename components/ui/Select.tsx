import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  options: readonly { value: string; label: string }[]
}

export default function Select({
  label,
  hint,
  options,
  id,
  required,
  ...rest
}: SelectProps) {
  const selectId = id || rest.name

  return (
    <div>
      <label htmlFor={selectId} className="block text-sm font-semibold">
        {label}
        {required && (
          <span className="ml-1 text-status-revision" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">필수</span>}
      </label>

      {hint && (
        <p id={`${selectId}-hint`} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      )}

      <select
        id={selectId}
        required={required}
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        className="mt-2 block w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-ink"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
