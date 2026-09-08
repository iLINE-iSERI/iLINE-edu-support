/**
 * 아직 준비 중인 화면 안내.
 *
 * ⚠️ **이용자가 보는 문구입니다.** 예전에는 `Phase 4′`, `대기: 갤러리 공개 방침`,
 *    `산출물 제출 (D-19)` 같은 **내부 계획 용어를 그대로 화면에 띄웠습니다.**
 *    만드는 사람에게는 편했지만, 신청자에게는 뜻을 알 수 없는 글자입니다.
 *    국고사업 사이트에서 그런 표시는 "미완성 사이트"로 읽힙니다. (09-08 정리)
 *
 *    **무엇을 기다리는지는 코드 주석과 `docs/3-할일/` 에 적습니다.**
 *    화면에는 이용자가 알아야 할 것만 씁니다.
 */
export default function Placeholder({
  title = '준비 중입니다',
  desc,
  items,
}: {
  title?: string
  /** 왜 비어 있는지 · 언제쯤 채워지는지 — 사람 말로 */
  desc: string
  /** 여기 들어올 내용 (선택) — 이용자가 이해할 수 있는 말로만 */
  items?: string[]
}) {
  return (
    <div className="container-page py-10">
      <div className="rounded-2xl border border-dashed border-line-strong bg-subtle p-6 sm:p-8 text-center">
        <p className="text-base font-bold">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          {desc}
        </p>

        {items && items.length > 0 && (
          <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm text-ink-muted">
            {items.map((it) => (
              <li key={it} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-subtle">
                  ·
                </span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
