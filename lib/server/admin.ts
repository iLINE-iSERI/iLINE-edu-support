/**
 * Firebase Admin SDK (서버 전용).
 *
 * 관리자 권한으로 Firestore·Storage 에 접근한다. **보안 규칙을 우회한다.**
 * 그래서 이 모듈을 쓰는 곳은 반드시 스스로 권한을 확인해야 한다.
 * 규칙이 막아주지 않는다는 것을 잊으면 남의 신청서를 열어주는 코드가 된다.
 */

import 'server-only'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getGoogleConfig } from './env'

let cached: App | null = null

function adminApp(): App {
  if (cached) return cached

  const cfg = getGoogleConfig()
  if (!cfg) throw new Error('서버 설정이 없습니다 (docs/2-학습/04-구글-시트-드라이브-연동.md)')

  cached =
    getApps().find((a) => a.name === 'support-admin') ??
    initializeApp(
      {
        credential: cert({
          projectId: cfg.projectId,
          clientEmail: cfg.clientEmail,
          privateKey: cfg.privateKey,
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      },
      'support-admin'
    )

  return cached
}

export const adminDb = () => getFirestore(adminApp())
export const adminAuth = () => getAuth(adminApp())
export const adminBucket = () => getStorage(adminApp()).bucket()

/**
 * 요청자를 확인한다.
 *
 * 브라우저가 보낸 ID 토큰을 검증해 uid 를 얻는다. 토큰은 위조할 수 없다.
 * 이걸 건너뛰고 body 의 uid 를 믿으면 누구나 남의 신청서를 동기화시킬 수 있다.
 */
export async function verifyRequester(
  authHeader: string | null
): Promise<{ uid: string; isStaff: boolean } | null> {
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null
  if (!token) return null

  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return { uid: decoded.uid, isStaff: decoded.supportStaff === true }
  } catch {
    return null
  }
}

/**
 * 이 uid 가 **테스트 계정**인가 (D-111 · 09-26) — 그 사람이 낸 것은 시트·드라이브로 보내지 않는다.
 *
 * 🔴 **요청한 사람이 아니라 문서 주인으로 판단한다.** 담당자가 테스트 계정 신청의 상태를
 *    바꿀 때도 동기화가 일어나는데, 그때 요청자는 담당자다. 주인을 봐야 시트로 새지 않는다.
 *
 * 신청서에 적힌 값(예: 신청자 사본)을 믿지 않고 **회원 문서를 직접** 읽는다 — 신청서는 본인이
 * 쓰는 문서라, 일반 회원이 스스로 「시험」이라고 적어 시트에서 빠질 수 있기 때문이다.
 * 시험 줄을 시트에서 빼는 것이 중요한 이유는 D-109 — 한 번 들어간 줄은 지우기 번거롭다.
 */
export async function isTesterUid(uid: string): Promise<boolean> {
  // 확인이 실패하면 「테스트 계정 아님」으로 본다 — 이 확인 때문에 **실제 회원의 동기화가
  // 멈추면 안 된다.** 반대로 틀려도(테스트 건이 시트로 감) D-109 뒤로는 지워도 안전하다.
  try {
    const snap = await adminDb().collection('support_users').doc(uid).get()
    return snap.data()?.role === 'tester'
  } catch (e) {
    console.warn('[iLINE] 테스트 계정 확인 실패 — 평소대로 동기화합니다:', e)
    return false
  }
}
