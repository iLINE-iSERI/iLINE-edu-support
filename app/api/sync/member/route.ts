/**
 * 회원 1명의 줄을 시트 「회원」 탭에 반영한다 (D-125 · 10-03).
 *
 *   POST /api/sync/member
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "uid"?: "..." }   ← 없으면 요청한 본인
 *
 * 가입 완료·회원정보 수정 뒤 **회원 화면이** 자기 줄을 맞춰 달라고 부른다. 남의 줄은 담당자만.
 * 줄에 들어가는 값은 요청이 아니라 **회원 문서에서 서버가** 읽는다 — 요청에는 누구의 줄인지만 있다.
 * 🔴 스위치(`MEMBER_SHEET_ENABLED`)가 꺼져 있으면 아무것도 쓰지 않는다 — 처리방침 개정 시행 전.
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다 — 누구의 줄을 쓸 수 있는지는 이 파일이 확인한다.
 */

import { NextResponse } from 'next/server'
import { verifyRequester, verifyStaffRequester } from '@/lib/server/admin'
import { getGoogleConfig } from '@/lib/server/env'
import { syncMemberAndRecord } from '@/lib/server/memberSheet'
import { MEMBER_SHEET_ENABLED } from '@/lib/config/memberSheet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!MEMBER_SHEET_ENABLED) return NextResponse.json({ skipped: 'disabled' })
  if (!getGoogleConfig()) return NextResponse.json({ skipped: 'not-configured' })

  const auth = req.headers.get('authorization')
  const who = await verifyRequester(auth)
  if (!who) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let uid = who.uid
  try {
    const body = await req.json()
    if (body?.uid) uid = String(body.uid)
  } catch {
    // 몸이 비어 있으면 본인
  }
  if (uid !== who.uid && !(await verifyStaffRequester(auth))) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const r = await syncMemberAndRecord(uid)
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json(r)
}
