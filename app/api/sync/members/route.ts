/**
 * [전체 반영] — 지금 사이트의 회원 전부로 시트 「회원」 탭을 맞춘다 (D-125 · 10-03). 담당자만.
 *
 *   POST /api/sync/members
 *   Authorization: Bearer <Firebase ID 토큰>
 *
 * ① 켤 때 이미 가입해 있던 회원을 처음 한 번 올리고 ② 자동 쓰기가 어긋났을 때 고친다. 몇 번 눌러도 결과가 같다.
 * 테스트 계정이 된 회원 · 같은 회원번호의 두 번째 줄 · 사이트에서 지워진 회원의 줄은 맨 끝에 행 삭제.
 * 끝나면 시트에 줄이 있게 된 회원마다 「마지막 반영 시각」을 적는다 — 「시트와 다름」 표시가 사라진다.
 *
 * 반영 시각은 **회원 목록을 읽기 전** 시각으로 적는다 — 반영하는 동안 누가 정보를 고치면 그 회원은
 * 「다름」으로 남아(고친 시각이 더 나중) 다음 자동 쓰기나 [전체 반영]이 맞춘다.
 */

import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, verifyStaffRequester } from '@/lib/server/admin'
import { getGoogleConfig } from '@/lib/server/env'
import { syncAllMembers } from '@/lib/server/googleSync'
import { COL } from '@/lib/firebase/config'
import { MEMBER_SHEET_ENABLED } from '@/lib/config/memberSheet'
import type { SupportUser } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 회원 수백 명이어도 시트 API 는 몇 번만 부르지만, 회원 문서에 시각을 적는 데 몇 초 걸릴 수 있다
export const maxDuration = 60

export async function POST(req: Request) {
  if (!(await verifyStaffRequester(req.headers.get('authorization')))) {
    return NextResponse.json({ error: '담당자만 할 수 있습니다.' }, { status: 403 })
  }
  if (!MEMBER_SHEET_ENABLED) {
    return NextResponse.json(
      { error: '회원 시트 연동이 꺼져 있습니다 — 처리방침 개정이 시행된 뒤 켭니다.' },
      { status: 400 }
    )
  }
  if (!getGoogleConfig()) {
    return NextResponse.json({ error: '서버에 구글 연동 설정이 없습니다.' }, { status: 503 })
  }

  const at = new Date()
  const db = adminDb()
  try {
    const snap = await db.collection(COL.users).get()
    const members = snap.docs.map((d) => ({ ...(d.data() as SupportUser), uid: d.id }))
    const r = await syncAllMembers(members, at)
    if (r.skipped) return NextResponse.json({ skipped: r.skipped })

    // 반영 시각 — 한 번에 500건까지라 나눠 쓴다
    const stamp = Timestamp.fromDate(at)
    for (let i = 0; i < r.syncedUids.length; i += 400) {
      const batch = db.batch()
      for (const uid of r.syncedUids.slice(i, i + 400)) {
        batch.update(db.collection(COL.users).doc(uid), { sheetSyncedAt: stamp, sheetSyncError: '' })
      }
      await batch.commit()
    }
    return NextResponse.json({ ok: true, written: r.written, appended: r.appended, removed: r.removed })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[iLINE] 회원 시트 전체 반영 실패:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
