import type { PolicySection } from '@/lib/privacy/current'

/** 조문 목록을 그린다 — 현행 판과 이전 판이 같은 모양이어야 비교가 된다 */
export default function PolicyBody({ sections }: { sections: PolicySection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-base font-bold tracking-tight">{s.title}</h2>
          <ul className="mt-3 space-y-2">
            {s.body.map((line) => (
              <li key={line} className="flex gap-2.5 break-keep text-sm leading-relaxed text-ink-muted">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-line-strong" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
