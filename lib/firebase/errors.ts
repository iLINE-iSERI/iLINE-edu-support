/**
 * Firestore / Storage 오류를 사용자에게 보여줄 문구로 바꾼다.
 *
 * 특히 `permission-denied` 는 두 가지 원인이 있는데 구분이 중요하다.
 *   · 보안 규칙이 아직 적용되지 않음  → 설정 문제. 이용자 잘못이 아니다
 *   · 권한이 없는 자원에 접근         → 정상적인 차단
 * 개발 단계에서는 대부분 전자이므로, 그 사실을 화면에 알려준다.
 */

export type FirebaseErrorKind =
  | 'permission-denied'
  /** 색인이 없어 쿼리를 실행할 수 없음 — 설정 문제다 */
  | 'failed-precondition'
  | 'unavailable'
  | 'not-found'
  | 'unknown'

/**
 * **우리가 직접 던진, 화면에 그대로 보여줄 안내문.**
 *
 * `firestoreErrorMessage()` 는 Firebase 오류 **코드**를 보고 문구를 고르므로,
 * 코드가 없는 평범한 `Error` 는 전부 "처리 중 문제가 발생했습니다"로
 * 뭉개진다. 그러면 **애써 쓴 안내가 사라진다** — 예를 들어 "그 사이 신청자가
 * 취소했습니다" 처럼 담당자가 다음에 뭘 해야 하는지 알려주는 문장이다.
 *
 * 그렇다고 아무 `Error` 의 message 를 그냥 보여주면 `undefined is not a
 * function` 같은 개발자용 문구가 이용자에게 나간다.
 * 그래서 **보여줘도 되는 오류에만 이 타입을 쓴다.**
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

/** 화면에 보여줄 문구 — 우리가 쓴 안내가 있으면 그것을 우선한다 */
export function actionErrorMessage(err: unknown): string {
  if (err instanceof UserFacingError) return err.message
  return firestoreErrorMessage(err)
}

export function firebaseErrorKind(err: unknown): FirebaseErrorKind {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''

  if (code.includes('permission-denied')) return 'permission-denied'
  if (code.includes('failed-precondition')) return 'failed-precondition'
  if (code.includes('unavailable') || code.includes('network'))
    return 'unavailable'
  if (code.includes('not-found')) return 'not-found'
  return 'unknown'
}

export function firestoreErrorMessage(err: unknown): string {
  switch (firebaseErrorKind(err)) {
    case 'permission-denied':
      return '데이터에 접근할 권한이 없습니다. 보안 규칙이 아직 적용되지 않았을 수 있습니다.'
    case 'failed-precondition':
      return '조회에 필요한 색인이 없습니다. 브라우저 콘솔(F12)의 오류 메시지에 색인 생성 링크가 함께 나옵니다.'
    case 'unavailable':
      return '네트워크 연결을 확인해 주세요.'
    case 'not-found':
      return '요청하신 정보를 찾을 수 없습니다.'
    default:
      return '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
}
