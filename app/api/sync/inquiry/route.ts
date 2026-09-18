/**
 * 1:1 문의 1건을 구글 시트 「문의」 탭에 반영한다 (D-93 · 09-18).
 *
 *   POST /api/sync/inquiry
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "inquiryId": "..." }
 *
 * 문의를 쓴 뒤(회원)와 답을 단 뒤(담당자)에 불린다. 줄이 있으면 그 줄을 고친다.
 * 이름·이메일은 문의 문서의 복사본이 아니라 **회원 문서**에서 읽는다 — 문의 문서의
 * authorName 은 화면 표시용이고 시트에는 원본이 나간다.
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다. 요청자가 이 문의의 주인인지(또는 담당자인지)는
 *    **이 파일이 직접** 확인한다.
 */

import { NextResponse } from 'next/server'
import { adminDb, verifyRequester } from '@/lib/server/admin'
import { syncInquiry } from '@/lib/server/googleSync'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'
import type { Inquiry, SupportUser } from '@/lib/types'

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

  let inquiryId: string
  try {
    inquiryId = String((await req.json()).inquiryId || '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!inquiryId) {
    return NextResponse.json({ error: '문의번호가 없습니다.' }, { status: 400 })
  }

  const db = adminDb()
  const ref = db.collection(COL.inquiries).doc(inquiryId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
  }
  const i = { id: snap.id, ...snap.data() } as Inquiry

  if (i.uid !== who.uid && !who.isStaff) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const memberSnap = await db.collection(COL.users).doc(i.uid).get()
  const m = memberSnap.data() as Partial<SupportUser> | undefined
  const author = { name: m?.name || i.authorName || '', email: m?.email || i.authorEmail || '' }

  const origin = new URL(req.url).origin
  const openUrl = `${origin}/staff/inquiries?id=${encodeURIComponent(i.id)}`

  try {
    const result = await syncInquiry(i, author, openUrl)
    if (result.skipped) return NextResponse.json({ skipped: 'not-configured' })
    await ref.update({
      sheetRowId: result.sheetRow ?? null,
      sheetSyncedAt: new Date(),
      sheetSyncError: '',
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[iLINE] 문의 시트 반영 실패:', message)
    await ref.update({ sheetSyncError: message.slice(0, 500) }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
