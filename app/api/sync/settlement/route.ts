/**
 * 정산 1건을 구글 드라이브(영수증)·시트(「정산」 탭)에 반영한다 (09-12 · D-65).
 *
 *   POST /api/sync/settlement
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "settlementId": "..." }
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다. 요청자가 이 정산의 주인인지(또는
 *    담당자인지)는 **이 파일이 직접** 확인한다.
 *
 * ⚠️ 계좌(bankInfo)는 읽지 않는다. syncSettlement 에 문서를 통째로 넘기지만
 *    그쪽도 계좌 필드를 건드리지 않는다 (D-38). 열을 늘릴 때 반출 범위 문서 먼저.
 *
 * 신청서 연동과 달리 **이미 반영된 건도 다시 돌린다** — 재제출·승인·지급 완료가
 * 같은 줄에 반영되어야 하기 때문이다. 파일은 중복 업로드되지 않는다.
 */

import { NextResponse } from 'next/server'
import { adminDb, adminBucket, verifyRequester } from '@/lib/server/admin'
import { syncSettlement, type ReceiptBlob } from '@/lib/server/googleSync'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'
import type { Settlement } from '@/lib/types'

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

  let settlementId: string
  try {
    settlementId = String((await req.json()).settlementId || '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!settlementId) {
    return NextResponse.json({ error: '정산 번호가 없습니다.' }, { status: 400 })
  }

  const db = adminDb()
  const ref = db.collection(COL.settlements).doc(settlementId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: '정산을 찾을 수 없습니다.' }, { status: 404 })
  }

  const st = { id: snap.id, ...snap.data() } as Settlement

  // 본인 또는 담당자만. 여기가 유일한 방어선이다.
  if (st.uid !== who.uid && !who.isStaff) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 임시 저장(draft)은 아직 낸 것이 아니다 — 내보내지 않는다
  if (st.status === 'draft') {
    return NextResponse.json({ skipped: 'draft' })
  }

  try {
    const bucket = adminBucket()
    const receipts: ReceiptBlob[] = []
    for (const r of st.receipts ?? []) {
      const f = bucket.file(r.storagePath)
      const [meta] = await f.getMetadata()
      const [data] = await f.download()
      receipts.push({
        storagePath: r.storagePath,
        fileName: r.fileName,
        contentType: String(meta.contentType || 'application/octet-stream'),
        data,
      })
    }

    const result = await syncSettlement(st, receipts)
    if (result.skipped) return NextResponse.json({ skipped: 'not-configured' })

    await ref.update({
      sheetRowId: result.sheetRow ?? null,
      driveFolderUrl: result.driveUrl || '',
      sheetSyncedAt: new Date(),
      driveSyncedAt: new Date(),
      driveSyncError: '',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[iLINE] 정산 동기화 실패:', message)
    // 실패 사유를 정산 문서에 남긴다 — 담당자 화면에서 보인다
    await ref.update({ driveSyncError: message.slice(0, 500) }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
