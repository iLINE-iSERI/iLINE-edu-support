import type { ReactNode } from 'react'

/** 목록이 비었을 때. "아직 없음"과 "오류"를 구분해서 보여준다. */
export default function EmptyState({
  title,
  desc,
  action,
}: {
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-subtle px-6 py-12 text-center">
      <p className="font-semibold text-ink-muted">{title}</p>
      {desc && (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-subtle">
          {desc}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
