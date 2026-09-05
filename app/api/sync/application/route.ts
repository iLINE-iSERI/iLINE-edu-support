/**
 * 신청 1건을 구글 시트·드라이브에 반영한다.
 *
 *   POST /api/sync/application
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "applicationId": "..." }
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다. 그러므로 이 파일이 **직접**
 *    "요청자가 이 신청서의 주인인가"를 확인해야 한다.
 *    본문에 담겨 온 uid 를 믿으면 누구나 남의 신청서를 동기화시킬 수 있다.
 */

import { NextResponse } from 'next/server'
import { adminDb, adminBucket, verifyRequester } from '@/lib/server/admin'
import { syncApplication } from '@/lib/server/googleSync'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'
import type { Application } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // 설정 전이라도 사이트는 정상 동작해야 한다. 오류가 아니라 '건너뜀'이다.
  if (!getGoogleConfig()) {
    return NextResponse.json({ skipped: 'not-configured' })
  }

  const who = await verifyRequester(req.headers.get('authorization'))
  if (!who) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let applicationId: string
  try {
    applicationId = String((await req.json()).applicationId || '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!applicationId) {
    return NextResponse.json({ error: '신청 번호가 없습니다.' }, { status: 400 })
  }

  const db = adminDb()
  const ref = db.collection(COL.applications).doc(applicationId)
  const snap = await ref.get()

  if (!snap.exists) {
    return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 })
  }

  const app = { id: snap.id, ...snap.data() } as Application

  // 본인 또는 담당자만. 여기가 유일한 방어선이다.
  if (app.uid !== who.uid && !who.isStaff) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 이미 올린 건은 다시 올리지 않는다 — 눌러도 시트에 중복 줄이 생기지 않게
  if (app.sheetSyncedAt) {
    return NextResponse.json({ skipped: 'already-synced' })
  }

  try {
    let pdf: Buffer | null = null
    if (app.generatedPdfPath) {
      const [buf] = await adminBucket().file(app.generatedPdfPath).download()
      pdf = buf
    }

    const result = await syncApplication(app, pdf)
    if (result.skipped) return NextResponse.json({ skipped: 'not-configured' })

    await ref.update({
      sheetRowId: result.sheetRow ? String(result.sheetRow) : '',
      driveFolderUrl: result.driveUrl || '',
      sheetSyncedAt: new Date(),
      driveSyncedAt: new Date(),
      driveSyncError: '',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[iLINE] 시트 동기화 실패:', message)

    // 실패 사유를 신청서에 남긴다. 담당자 화면에서 보이므로
    // "왜 시트에 안 올라왔지?" 를 콘솔 없이 알 수 있다.
    await ref.update({ driveSyncError: message.slice(0, 500) }).catch(() => {})

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
