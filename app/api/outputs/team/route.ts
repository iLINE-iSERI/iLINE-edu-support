/**
 * 우리 팀이 올린 산출물 — 같은 프로그램에 **같은 팀명으로 신청한 다른 계정**의
 * 제출물까지 돌려준다 (D-76 · 09-17).
 *
 *   POST /api/outputs/team
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "programId": "..." }
 *
 * 왜 서버인가 — 보안 규칙은 "요청자가 그 팀인가"를 판정할 수 없다. 팀은
 * 신청서의 팀명 텍스트로만 묶이고, 그걸 확인하려면 **다른 사람의 신청서**를
 * 읽어야 하는데 규칙은 그걸 허용하지 않는다(허용해서도 안 된다). 그래서
 * Admin SDK 로 여기서 확인한다.
 *
 * ⚠️ Admin SDK 는 규칙을 우회한다. 요청자 확인은 **이 파일이 직접** 한다:
 *   ① ID 토큰 검증 → uid
 *   ② 그 uid 의 **선정된** 신청 건이 이 프로그램에 있는가 — 없으면 빈 목록
 *   ③ 그 신청서의 팀명 — 없으면(개인) 본인 것만
 *   ④ 같은 프로그램 · 같은 팀명의 선정된 신청 건들의 uid 를 모아 그 제출물을 돌려준다
 * 담당자는 규칙으로 직접 읽으므로 이 경로를 쓰지 않는다.
 *
 * 내려진 것(hiddenByStaff)도 **본인 것은** 돌려준다 — 규칙이 본인에게는 보이게
 * 하는 것과 같은 판단. 남의 것은 내려졌으면 뺀다.
 */

import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, verifyRequester } from '@/lib/server/admin'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'
import { teamNameOf } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Firestore Timestamp → 밀리초. 클라이언트(outputs.ts · fromWire)가 되돌린다 */
function wire(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toMillis()
  if (Array.isArray(v)) return v.map(wire)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = wire(x)
    return out
  }
  return v
}

export async function POST(req: Request) {
  if (!getGoogleConfig()) {
    // Admin SDK 설정이 없는 환경(로컬 초기) — 팀 묶음 없이 본인 것만 보게 된다
    return NextResponse.json({ outputs: [], skipped: 'not-configured' })
  }

  const who = await verifyRequester(req.headers.get('authorization'))
  if (!who) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let programId: string
  try {
    programId = String((await req.json()).programId || '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!programId) {
    return NextResponse.json({ error: '프로그램이 없습니다.' }, { status: 400 })
  }

  const db = adminDb()

  // ② 내 선정 건
  const mineSnap = await db
    .collection(COL.applications)
    .where('uid', '==', who.uid)
    .where('programId', '==', programId)
    .where('status', '==', 'approved')
    .limit(1)
    .get()
  if (mineSnap.empty) return NextResponse.json({ outputs: [] })

  const mine = mineSnap.docs[0].data()
  const team = teamNameOf(mine as Parameters<typeof teamNameOf>[0])

  // ③④ 팀원 uid — 팀명이 없으면 나 혼자
  let uids = [who.uid]
  if (team) {
    const all = await db
      .collection(COL.applications)
      .where('programId', '==', programId)
      .where('status', '==', 'approved')
      .get()
    uids = all.docs
      .filter((d) => teamNameOf(d.data() as Parameters<typeof teamNameOf>[0]) === team)
      .map((d) => d.data().uid as string)
    if (!uids.includes(who.uid)) uids.push(who.uid)
  }

  // 제출물 — uid 'in' 은 30개까지. 팀은 그보다 작다
  const outputs: Record<string, unknown>[] = []
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30)
    const snap = await db
      .collection(COL.outputs)
      .where('programId', '==', programId)
      .where('uid', 'in', chunk)
      .get()
    for (const d of snap.docs) {
      const o = d.data()
      // 남의 것 중 내려진 것은 뺀다
      if (o.uid !== who.uid && o.hiddenByStaff === true) continue
      outputs.push({ id: d.id, ...(wire(o) as Record<string, unknown>) })
    }
  }

  return NextResponse.json({ outputs, teamName: team ?? null })
}
