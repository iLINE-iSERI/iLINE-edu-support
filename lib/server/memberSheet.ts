/**
 * 회원 1명을 시트 「회원」 탭에 반영하고, 그 결과를 회원 문서에 적는다 (D-125 · 10-03) — 서버 전용.
 *
 * 회원 문서의 `sheetSyncedAt`(마지막 반영 시각) · `sheetSyncError`(실패 사유)는 **여기서만** 쓴다(Admin).
 * 담당자 화면이 이 두 칸으로 「시트와 다름」을 판정한다(`lib/config/memberSheet.ts`).
 *
 * 부르는 곳 — `/api/sync/member`(가입 완료·회원정보 수정 뒤 회원 화면이) · `/api/staff/role`(담당자 지정·회수 뒤 서버가).
 * 시트가 실패해도 부른 일(가입·수정·역할 변경)은 이미 끝난 것이다 — 실패는 기록만 하고 던지지 않는다.
 */

import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './admin'
import { syncMember } from './googleSync'
import { COL } from '@/lib/firebase/config'
import { MEMBER_SHEET_ENABLED } from '@/lib/config/memberSheet'
import type { SupportUser } from '@/lib/types'

export interface MemberRecordResult {
  ok?: true
  skipped?: 'disabled' | 'not-configured' | 'tester' | 'no-member'
  error?: string
  sheetRow?: number
}

export async function syncMemberAndRecord(uid: string): Promise<MemberRecordResult> {
  if (!MEMBER_SHEET_ENABLED) return { skipped: 'disabled' }
  const ref = adminDb().collection(COL.users).doc(uid)
  const snap = await ref.get()
  if (!snap.exists) return { skipped: 'no-member' }
  const m = { ...(snap.data() as SupportUser), uid: snap.id }
  // 테스트 계정은 시트로 보내지 않는다(D-111). 이미 있던 줄은 [전체 반영]이 지운다
  if (m.role === 'tester') return { skipped: 'tester' }

  try {
    const r = await syncMember(m)
    if (r.skipped) return { skipped: r.skipped }
    await ref.update({ sheetSyncedAt: FieldValue.serverTimestamp(), sheetSyncError: '' })
    return { ok: true, sheetRow: r.sheetRow }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[iLINE] 회원 시트 반영 실패:', message)
    await ref.update({ sheetSyncError: message.slice(0, 500) }).catch(() => {})
    return { error: message }
  }
}
