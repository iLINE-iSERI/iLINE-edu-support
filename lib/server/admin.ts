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
  if (!cfg) throw new Error('서버 설정이 없습니다 (docs/11-sheet-drive-setup.md)')

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
