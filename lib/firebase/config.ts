// Firebase 초기화 — 그뤠잇과 같은 프로젝트를 사용한다 (D-8, S2)
// 데이터는 support_* 컬렉션과 /support/ Storage 경로로 분리한다.
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// 중복 초기화 방지 (HMR 대응)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// undefined 필드 자동 무시 — 옵셔널 필드를 빈 값으로 둘 수 있도록
let _db: Firestore
try {
  _db = initializeFirestore(app, { ignoreUndefinedProperties: true })
} catch {
  _db = getFirestore(app)
}

export const auth = getAuth(app)
export const db = _db
export const storage = getStorage(app)
export default app

/** Firestore 컬렉션 이름 — 그뤠잇과 충돌하지 않도록 접두어 고정 */
export const COL = {
  users: 'support_users',
  applications: 'support_applications',
  settlements: 'support_settlements',
  outputs: 'support_outputs',
  notices: 'support_notices',
  resources: 'support_resources',
} as const

/** Storage 경로 접두어 */
export const STORAGE_ROOT = 'support'
