/**
 * 공지 첨부 받을 주소 — 글의 공개 범위와 요청자의 회원 여부를 보고 **한 시간짜리 주소**를 내준다
 * (D-113 · 09-27).
 *
 *   POST /api/notices/files
 *   Authorization: Bearer <Firebase ID 토큰>   ← 로그인했으면. 전체 공개 글은 없어도 된다
 *   { "noticeId": "..." }
 *   → 200 { files: [{ storagePath, fileName, size, url }] }
 *   → 403 { locked: true }   자격 없음(회원만 · 비공개)
 *
 * 왜 서버인가 — 파일은 공개 범위와 상관없이 **비공개 폴더** `support/notices/{id}/` 에 있다.
 * 폴더를 공개 범위마다 나누면 담당자가 범위를 바꿀 때마다 파일을 옮겨야 하고, 브라우저 쪽
 * Storage 는 파일을 복사하지 못한다. 그래서 파일은 한곳에 두고 **여기서** 자격을 본다.
 * 나중에 「선정자만」 같은 단계를 더해도 이 파일의 확인 한 줄만 늘어난다.
 *
 * ⚠️ Admin SDK 는 규칙을 우회한다. 자격 확인은 **이 파일이 직접** 한다 — firestore.rules 의
 * `canReadNoticeBody` 와 **같은 판단**이어야 한다(본문은 규칙이, 파일은 여기가 막는다):
 *   public  → 누구나
 *   members → 활동 중인 회원(가입 2단계를 마친 사람 · 담당자·테스트 계정 포함)
 *   private → 담당자
 *
 * 한 시간짜리 주소는 그동안은 누구에게 전달돼도 열린다. 받은 파일을 다시 퍼뜨리는 것은 어차피
 * 못 막는다 — 「회원만」은 개인정보 보호 수단이 아니다(운영 매뉴얼 §8).
 */

import { NextResponse } from 'next/server'
import { adminBucket, adminDb, verifyRequester } from '@/lib/server/admin'
import { getGoogleConfig } from '@/lib/server/env'
import { COL } from '@/lib/firebase/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 주소가 살아 있는 시간 — 화면을 열어 두고 한참 뒤에 눌러도 되게 넉넉히 */
const URL_TTL_MS = 60 * 60 * 1000

interface StoredFile {
  storagePath: string
  fileName: string
  size: number
}

/** 받을 때 원래 이름으로 — 안 주면 `1727…_공고문.hwp` 처럼 숫자가 붙어 내려받아진다 */
function disposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `inline; filename*=UTF-8''${encoded}`
}

export async function POST(req: Request) {
  if (!getGoogleConfig()) {
    return NextResponse.json({ error: '서버 설정이 없습니다.' }, { status: 503 })
  }

  let noticeId: string
  try {
    noticeId = String((await req.json()).noticeId || '')
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  // 문서 번호에 슬래시가 들어가면 다른 경로를 가리킬 수 있다
  if (!noticeId || noticeId.includes('/')) {
    return NextResponse.json({ error: '공지가 없습니다.' }, { status: 400 })
  }

  const db = adminDb()
  const noticeSnap = await db.collection(COL.notices).doc(noticeId).get()
  if (!noticeSnap.exists) {
    return NextResponse.json({ error: '공지를 찾을 수 없습니다.' }, { status: 404 })
  }
  const notice = noticeSnap.data() ?? {}
  const visibility = (notice.visibility as string | undefined) ?? 'public'

  if (visibility !== 'public') {
    const who = await verifyRequester(req.headers.get('authorization'))
    let allowed = false
    if (who) {
      // 담당자 여부도 회원 문서로 본다 — firestore.rules 의 isStaff() 와 같은 기준
      const member = (await db.collection('support_users').doc(who.uid).get()).data()
      const active = member?.status === 'active'
      allowed = visibility === 'members' ? active : active && member?.role === 'staff'
    }
    if (!allowed) return NextResponse.json({ locked: true }, { status: 403 })
  }

  // 속지가 있으면 속지, 없으면 D-113 이전 공지(겉장에 목록)
  const bodySnap = await noticeSnap.ref.collection('body').doc('main').get()
  const stored = ((bodySnap.exists ? bodySnap.data()?.files : notice.files) ?? []) as StoredFile[]

  // 이 공지의 폴더에 있는 파일만 — 속지를 누가 잘못 고쳐도 남의 신청 서류 같은 다른 파일의
  // 주소를 내주지 않게 (속지는 담당자만 쓰지만 한 번 더 막는다)
  const allowedPrefixes = [`support/notices/${noticeId}/`, `support/public/notices/${noticeId}/`]
  const bucket = adminBucket()
  const expires = Date.now() + URL_TTL_MS

  const files = await Promise.all(
    stored
      .filter((f) => allowedPrefixes.some((p) => String(f.storagePath).startsWith(p)))
      .map(async (f) => {
        const [url] = await bucket.file(f.storagePath).getSignedUrl({
          version: 'v4',
          action: 'read',
          expires,
          responseDisposition: disposition(f.fileName),
        })
        return { storagePath: f.storagePath, fileName: f.fileName, size: f.size, url }
      })
  )

  return NextResponse.json({ files })
}
