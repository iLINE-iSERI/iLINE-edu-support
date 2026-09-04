/**
 * 미구현 화면 표시용 — 어떤 결정/단계를 기다리는지 화면에서 바로 보이게 한다.
 * 구현이 끝나면 이 컴포넌트를 지운다.
 */
export default function Placeholder({
  phase,
  blockedBy,
  items,
}: {
  /** 예: 'Phase 3' */
  phase: string
  /** 예: 'H-1 신청서 폼 명세' — 없으면 대기 없이 구현 예정 */
  blockedBy?: string
  /** 이 화면에 들어갈 내용 목록 */
  items: string[]
}) {
  return (
    <div className="container-page py-10">
      <div className="rounded-2xl border border-dashed border-line-strong bg-subtle p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-300">
            {phase}
          </span>
          {blockedBy && (
            <span className="rounded-full bg-status-revision/10 px-2.5 py-1 text-xs font-bold text-status-revision">
              대기: {blockedBy}
            </span>
          )}
        </div>

        <p className="mt-4 text-sm font-semibold text-ink-muted">
          이 화면에 들어갈 내용
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span aria-hidden="true" className="text-ink-subtle">
                ·
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
