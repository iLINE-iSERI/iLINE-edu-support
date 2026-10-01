/**
 * 담당자 지정·회수 (D-120 · 10-02) — 「회원 관리」 화면의 [담당자로 지정] · [담당자 권한 회수]
 *
 *   POST /api/staff/role
 *   Authorization: Bearer <Firebase ID 토큰>
 *   { "uid": "...", "action": "grant" | "revoke", "reason": "..." }
 *
 * `scripts/grant-staff.mjs` 가 하던 두 가지를 서버가 한다.
 *   ① 회원 문서 `role` ('staff' ↔ 'applicant') — 「관리」 화면과 Firestore 규칙
 *   ② Custom Claims `supportStaff` — Storage 첨부·PDF 열람 (Storage 규칙은 Firestore 를 못 읽는다)
 * 그리고 ③ `support_role_changes` 에 기록을 남긴다(①과 같은 트랜잭션).
 *
 * ⚠️ Admin SDK 는 보안 규칙을 우회한다. 아래 확인은 **전부 이 파일이** 한다.
 *   · 요청자 — 로그인 토큰의 supportStaff **와** 회원 문서의 role·status 가 둘 다 담당자여야 한다.
 *     회수된 사람의 토큰에는 supportStaff 가 최대 1시간 남아 있어 토큰만 믿으면 안 된다
 *   · 지정 — 탈퇴·테스트 계정은 안 된다. **이메일 인증된 계정만**(담당자는 모든 신청자의
 *     개인정보를 본다 — 주소의 주인이 확인되지 않은 계정에 줄 수 없다 · 10-02 sunbell)
 *   · 회수 — **자기 자신은 안 된다.** 그러면 담당자가 0명이 되는 일도 저절로 막힌다
 *   · 사유 — 지정·회수 모두 반드시(10-02 sunbell)
 *
 * 몇 번 눌러도 결과가 같다 — 역할이 이미 목표와 같으면 기록은 새로 남기지 않고 ②만 다시 맞춘다.
 * ①은 됐는데 ②가 실패하면 화면이 같은 버튼을 그대로 두므로 한 번 더 누르면 고쳐진다.
 *
 * 시트·공유 드라이브 공유는 여기서 하지 않는다(사이트가 할 수 없는 일) — 화면이 안내한다.
 */

import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb, verifyRequester } from '@/lib/server/admin'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'
import { ROLE_REASON_MAX, type SupportRole } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 화면에 그대로 보여 줄 거절 — 다른 오류(예상 못 한 것)와 구별한다 */
class Refusal extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function POST(req: Request) {
  if (!getGoogleConfig()) {
    return NextResponse.json({ error: '서버에 관리자 설정이 없습니다.' }, { status: 503 })
  }

  const who = await verifyRequester(req.headers.get('authorization'))
  if (!who) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  if (!who.isStaff) {
    return NextResponse.json({ error: '담당자만 할 수 있습니다.' }, { status: 403 })
  }

  let uid: string
  let action: string
  let reason: string
  try {
    const body = await req.json()
    uid = String(body.uid || '')
    action = String(body.action || '')
    reason = String(body.reason ?? '').trim()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!uid || (action !== 'grant' && action !== 'revoke')) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: '사유를 적어 주세요.' }, { status: 400 })
  }
  if (reason.length > ROLE_REASON_MAX) {
    return NextResponse.json({ error: `사유는 ${ROLE_REASON_MAX}자까지입니다.` }, { status: 400 })
  }
  if (action === 'revoke' && uid === who.uid) {
    return NextResponse.json(
      { error: '자기 자신의 담당자 권한은 회수할 수 없습니다. 다른 담당자에게 부탁해 주세요.' },
      { status: 400 }
    )
  }

  const to: SupportRole = action === 'grant' ? 'staff' : 'applicant'
  const db = adminDb()

  try {
    // 요청자 — 토큰만이 아니라 회원 문서도 지금 담당자인가
    const me = (await db.collection(COL.users).doc(who.uid).get()).data()
    if (me?.role !== 'staff' || me?.status !== 'active') {
      throw new Refusal('담당자만 할 수 있습니다.', 403)
    }

    const target = await adminAuth()
      .getUser(uid)
      .catch(() => null)
    if (!target) throw new Refusal('그 회원의 로그인 계정을 찾을 수 없습니다.', 404)

    const ref = db.collection(COL.users).doc(uid)
    const changed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) {
        throw new Refusal('회원 문서가 없습니다. 회원가입 2단계(참여 정보)까지 마친 계정만 됩니다.', 404)
      }
      const from = (snap.get('role') ?? 'applicant') as SupportRole

      if (action === 'grant') {
        if (snap.get('status') !== 'active') {
          throw new Refusal('탈퇴한 회원은 담당자로 지정할 수 없습니다.', 400)
        }
        if (from === 'tester') {
          throw new Refusal(
            '테스트 계정은 담당자로 지정할 수 없습니다. 실제로 쓰는 계정으로 지정해 주세요.',
            400
          )
        }
        if (!target.emailVerified) {
          throw new Refusal(
            '이메일 인증이 안 된 계정입니다. 그 사람이 「회원정보 수정」에서 인증 메일을 받아 인증한 뒤 다시 지정해 주세요.',
            400
          )
        }
      } else if (from === 'tester') {
        // 테스트 계정을 회수 버튼으로 일반 회원이 되게 하지 않는다 — 테스트 지정은 관리 도구 몫
        throw new Refusal('담당자가 아닙니다(테스트 계정).', 400)
      }

      if (from === to) return false // 이미 그 역할 — ②만 다시 맞춘다
      tx.update(ref, { role: to })
      tx.create(db.collection(COL.roleChanges).doc(), {
        uid,
        from,
        to,
        by: who.uid,
        via: 'site',
        reason,
        at: FieldValue.serverTimestamp(),
      })
      return true
    })

    // ② Claims — 다른 claims 는 보존하고 하나만 바꾼다(grant-staff.mjs 와 같은 이유)
    try {
      const claims = { ...(target.customClaims ?? {}) }
      if (to === 'staff') claims.supportStaff = true
      else delete claims.supportStaff
      await adminAuth().setCustomUserClaims(uid, claims)
    } catch (e) {
      console.error('[iLINE] 담당자 Claims 변경 실패:', e)
      throw new Refusal(
        '역할은 바꿨지만 첨부 파일 열람 권한을 바꾸지 못했습니다. 같은 버튼을 한 번 더 눌러 주세요.',
        500
      )
    }

    return NextResponse.json({ ok: true, role: to, changed })
  } catch (e) {
    if (e instanceof Refusal) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[iLINE] 담당자 지정·회수 실패:', e)
    return NextResponse.json({ error: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
