/**
 * 실제 문안이 확정되지 않은 화면에 붙이는 경고.
 * 공고문·약관 등이 확정되면 이 컴포넌트와 함께 제거한다.
 *
 * ⚠️ 이게 붙은 화면은 대외 공개 전에 반드시 검토를 받아야 한다.
 */
export default function DraftNotice({ what }: { what: string }) {
  return (
    <div
      role="note"
      className="rounded-xl border border-status-revision/40 bg-status-revision/10 px-4 py-3 text-sm leading-relaxed"
    >
      <strong className="font-bold text-status-revision">임시 문안</strong>
      <span className="ml-2 text-ink-muted">
        {what} 확정 전 예시입니다. 공개 전 실제 내용으로 교체해야 합니다.
      </span>
    </div>
  )
}
