/**
 * 보안 규칙이 아직 적용되지 않았을 때 보여주는 안내.
 *
 * 개발 단계에서 "왜 안 되지?" 하고 헤매지 않도록, 원인과 해결 방법을
 * 화면에 직접 적어둔다. 규칙을 적용하면 저절로 사라진다.
 */
export default function SetupNotice({ message }: { message?: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm leading-relaxed"
    >
      <p className="font-bold text-status-revision">
        아직 데이터베이스 설정이 끝나지 않았습니다
      </p>
      <p className="mt-1.5 text-ink-muted">
        {message ||
          '회원 정보를 읽을 권한이 없습니다.'}{' '}
        Firebase 보안 규칙이 적용되면 정상 동작합니다.
      </p>
      <p className="mt-2 text-xs text-ink-subtle">
        담당 개발자에게: <code>firebase-deploy/</code> 의 병합본을 Firebase
        콘솔에 게시하세요. 절차는 <code>docs/TODO-later.md</code> A항목 참고.
      </p>
    </div>
  )
}
