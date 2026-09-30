/**
 * 정산 1건을 구글 드라이브(증빙서류)·시트(「정산」 탭)에 반영한다 (09-12 · D-65 · D-117).
 *
 *   POST /api/sync/settlement
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "settlementId": "..." }
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다. 요청자가 이 정산의 주인인지(또는
 *    담당자인지)는 **이 파일이 직접** 확인한다.
 *
 * ⚠️ 계좌는 읽지 않는다(D-38) — D-108(09-25)부터는 아예 받지 않는다.
 *    열을 늘릴 때 반출 범위 문서 먼저.
 *
 * 신청서 연동과 달리 **이미 반영된 건도 다시 돌린다** — 재제출·확인 완료·지급 완료가
 * 같은 줄에 반영되어야 하기 때문이다. 파일은 중복 업로드되지 않는다.
 *
 * D-117: 팀명(드라이브 팀 폴더 · 시트 「팀명」)은 **여기서 신청서·공고로 계산한다** —
 *   정산 문서에는 팀명이 없고, 제출하는 브라우저가 적은 값은 믿지 않는다(보안 점검 08 B).
 *   파일은 **이 정산의 Storage 자리**(`support/settlements/{주인}/{정산번호}/`)에 있는 것만
 *   받는다 — Admin 권한으로 내려받으므로, 목록에 남의 경로를 적어 드라이브로 빼 가는 것을 막는다.
 */

import { NextResponse } from 'next/server'
import { adminDb, adminBucket, verifyRequester, isTesterUid } from '@/lib/server/admin'
import { syncSettlement, type ReceiptBlob } from '@/lib/server/googleSync'
import { getGoogleConfig } from '@/lib/server/env'
import { COL, STORAGE_ROOT } from '@/lib/firebase/config'
import { teamNameOf, type Application, type Program, type Settlement } from '@/lib/types'

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

  // D-111: 테스트 계정이 낸 것은 시트·드라이브로 보내지 않는다 — **주인 기준**(담당자가
  // 상태를 바꿔 동기화될 때도). 까닭을 문서에 남겨 담당자 화면이 「시험」으로 보이게 한다.
  // 🔴 **한 번 「시험」이면 계속 시험이다** — 그 계정을 일반 회원으로 되돌리거나 지운 뒤
  //    담당자가 상태를 바꿔도, 주인이 더는 테스트 계정이 아니라서 시트로 새던 빈틈을 막는다.
  //    (반대로 되돌린 뒤 **새로** 낸 것은 표시가 없으니 평소대로 간다 — 사람이 아니라 문서 기준)
  if (snap.get('sheetSkipped') === 'tester' || (await isTesterUid(st.uid))) {
    await ref.update({ sheetSkipped: 'tester', driveSyncError: '' }).catch(() => {})
    return NextResponse.json({ skipped: 'tester' })
  }

  // 임시 저장(draft)은 아직 낸 것이 아니다 — 내보내지 않는다
  if (st.status === 'draft') {
    return NextResponse.json({ skipped: 'draft' })
  }

  // 이 정산의 자리에 있는 파일만 (D-117 · 보안 점검 08 §6)
  const prefix = `${STORAGE_ROOT}/settlements/${st.uid}/${st.id}/`
  const outside = (st.receipts ?? []).filter((r) => !String(r.storagePath || '').startsWith(prefix))
  if (outside.length > 0) {
    const message = `증빙서류 경로가 이 정산의 자리가 아닙니다(${outside.length}개) — 반영하지 않았습니다.`
    await ref.update({ driveSyncError: message }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    // 팀명 — 신청서와 공고로 서버가 계산한다(teamNameOf 는 공고의 「팀명 칸」을 봐야 한다)
    const [appSnap, programSnap] = await Promise.all([
      db.collection(COL.applications).doc(st.applicationId).get(),
      db.collection(COL.programs).doc(st.programId).get(),
    ])
    const team = teamNameOf(
      appSnap.exists ? (appSnap.data() as Application) : null,
      programSnap.exists ? (programSnap.data() as Program) : null
    )

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
        docLabel: r.docLabel,
      })
    }

    const result = await syncSettlement(st, receipts, { team })
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
