/**
 * 회원 시트 — 켜는 스위치와 「시트와 다름」 판정 (D-125 · 10-03)
 *
 * 🔴 **처리방침 제5조 위탁 목록에 「회원 정보」가 들어간 개정이 시행된 뒤에 켠다**(교수님께 여쭐 것 ⑫).
 *    켜는 법: Vercel 환경변수 `NEXT_PUBLIC_MEMBER_SHEET_ENABLED=1` → 다시 배포. 기본은 꺼짐.
 *    화면 버튼으로 두지 않은 까닭 — 담당자가 개정 시행 전에 실수로 켤 수 있어서.
 *    꺼져 있으면 자동 쓰기·[전체 반영] 모두 시트에 아무것도 쓰지 않고, 「시트와 다름」 표시도 하지 않는다.
 *
 * `NEXT_PUBLIC_` 이라 화면과 서버가 같은 값을 본다(배포할 때 정해진다 — 바꾸면 다시 배포).
 * 비밀이 아니라 「켜졌나」만 알리는 값이다.
 *
 * 반출 범위: docs/4-기록/02-시트-드라이브-반출-범위.md §1-5
 */

import type { SupportUser } from '@/lib/types'

export const MEMBER_SHEET_ENABLED = process.env.NEXT_PUBLIC_MEMBER_SHEET_ENABLED === '1'

/** 방금 저장해 아직 쓰는 중인 회원을 「다름」으로 띄우지 않으려고 기다려 주는 시간 */
export const MEMBER_SHEET_GRACE_MS = 2 * 60 * 1000

type SheetFields = Pick<SupportUser, 'role' | 'createdAt' | 'updatedAt' | 'sheetSyncedAt' | 'sheetSyncError'>

/**
 * 이 회원의 줄이 시트와 다를 수 있는가 — 관리 줄 「회원」 숫자 · 회원 관리 배지.
 *
 *   · 반영하다 **실패**했다(사유가 남아 있음)
 *   · 회원 정보가 **마지막 반영보다 나중에** 바뀌었다 — 저장 뒤 브라우저를 닫아 아예 쓰러 가지 못한 경우까지 잡힌다
 *   · **반영 기록이 없다** — 새 가입자, 또는 켜기 전부터 있던 회원([전체 반영] 전)
 * 앞의 둘이 아닌 「아직 안 씀」은 바뀐 지 2분이 지나야 다름으로 본다(지금 쓰는 중일 수 있어서).
 * 테스트 계정은 시트로 가지 않으므로 늘 아니다(D-111).
 */
export function memberSheetBehind(m: SheetFields, now: number = Date.now()): boolean {
  if (!MEMBER_SHEET_ENABLED || m.role === 'tester') return false
  if (m.sheetSyncError) return true
  const changed = Math.max(m.createdAt?.toMillis?.() ?? 0, m.updatedAt?.toMillis?.() ?? 0)
  const synced = m.sheetSyncedAt?.toMillis?.() ?? 0
  if (synced >= changed && synced > 0) return false
  return now - changed > MEMBER_SHEET_GRACE_MS
}
