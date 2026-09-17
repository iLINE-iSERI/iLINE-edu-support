/**
 * 개인정보처리방침 — **이전 판 보관소** (D-77)
 *
 * 개정할 때 `current.ts` 의 FACTS·SECTIONS 를 통째로 복사해 여기 넣는다.
 * 키는 그 판의 시행일 slug (`2026-09-18`), 주소는 `/privacy/2026-09-18`.
 * 현행 판은 여기 없다 — `/privacy` 가 current.ts 를 그린다.
 *
 * ⚠️ 복사할 때 SECTIONS 안의 `${FACTS.retention}` 같은 값은 이미 문자열로 풀려
 *    있으므로(템플릿이 평가된 뒤), 옛 판의 FACTS 를 함께 넣어 두면 그 판이
 *    무슨 값이었는지 남는다.
 */

import type { PolicySection } from './current'

export interface ArchivedPolicy {
  effectiveDate: string
  facts: Record<string, unknown>
  sections: PolicySection[]
}

export const VERSIONS: Record<string, ArchivedPolicy> = {
  // '2026-09-18': { effectiveDate: '2026. 9. 18.', facts: {...}, sections: [...] },
}
