/**
 * 산출물 1건을 구글 시트 「산출물」 탭에 반영한다 (D-76 · 09-17).
 *
 *   POST /api/sync/output
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "outputId": "..." }
 *
 * **파일은 나가지 않는다** — 시트에는 현황 한 줄(누가·언제·몇 개·상태)과
 * 담당자 화면으로 가는 링크만. 드라이브 업로드는 1차 범위 밖(D-75 ⑦).
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다. 요청자가 이 산출물의 주인인지(또는
 *    담당자인지)는 **이 파일이 직접** 확인한다.
 *
 * 제출·다시 제출·추가 요청·내리기 뒤에 불린다. 줄이 있으면 그 줄을 고친다.
 */

import { NextResponse } from 'next/server'
import { adminDb, verifyRequester, isTesterUid } from '@/lib/server/admin'
import { syncOutput } from '@/lib/server/googleSync'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'
import type { Output } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!getGoogleConfig()) {
    return NextResponse.json({ skipped: 'not-configured' })
  }

  const who = await verifyRequester(req.headers.get('authorization'))
  if (!who) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let outputId: string
  try {
    outputId = String((await req.json()).outputId || '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!outputId) {
    return NextResponse.json({ error: '제출번호가 없습니다.' }, { status: 400 })
  }

  const db = adminDb()
  const ref = db.collection(COL.outputs).doc(outputId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: '산출물을 찾을 수 없습니다.' }, { status: 404 })
  }
  const o = { id: snap.id, ...snap.data() } as Output

  // 본인 또는 담당자만. 여기가 유일한 방어선이다.
  if (o.uid !== who.uid && !who.isStaff) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // D-111: 테스트 계정이 낸 것은 시트·드라이브로 보내지 않는다 — **주인 기준**(담당자가
  // 상태를 바꿔 동기화될 때도). 까닭을 문서에 남겨 담당자 화면이 「시험」으로 보이게 한다.
  // 🔴 **한 번 「시험」이면 계속 시험이다** — 그 계정을 일반 회원으로 되돌리거나 지운 뒤
  //    담당자가 상태를 바꿔도, 주인이 더는 테스트 계정이 아니라서 시트로 새던 빈틈을 막는다.
  //    (반대로 되돌린 뒤 **새로** 낸 것은 표시가 없으니 평소대로 간다 — 사람이 아니라 문서 기준)
  if (snap.get('sheetSkipped') === 'tester' || (await isTesterUid(o.uid))) {
    await ref.update({ sheetSkipped: 'tester', driveSyncError: '' }).catch(() => {})
    return NextResponse.json({ skipped: 'tester' })
  }

  // 담당자 화면 주소 — 요청이 온 호스트를 그대로 쓴다 (운영·미리보기 어느 쪽이든 맞는 주소)
  const origin = new URL(req.url).origin
  const openUrl = `${origin}/staff/outputs?program=${encodeURIComponent(o.programId)}`

  try {
    const result = await syncOutput(o, openUrl)
    if (result.skipped) return NextResponse.json({ skipped: 'not-configured' })

    await ref.update({
      sheetRowId: result.sheetRow ?? null,
      sheetSyncedAt: new Date(),
      sheetSyncError: '',
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[iLINE] 산출물 시트 반영 실패:', message)
    await ref.update({ sheetSyncError: message.slice(0, 500) }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
