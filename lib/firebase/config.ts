// Firebase 초기화 — iLINE과 같은 프로젝트를 사용한다 (D-8, S2)
// 데이터는 support_* 컬렉션과 /support/ Storage 경로로 분리한다.
//
// ⚠️ 지연 초기화(lazy)로 구현한 이유
//    모듈을 불러오는 즉시 initializeApp()을 호출하면, 환경변수가 없는 환경
//    (CI, 최초 클론 직후, 정적 페이지 프리렌더링)에서 빌드가 통째로 실패한다.
//    실제로 쓰는 시점에 초기화하면 Firebase를 쓰지 않는 페이지는 영향이 없고,
//    설정이 빠졌을 때도 "그 화면만" 안내 메시지를 띄울 수 있다.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** 환경변수가 채워져 있는지 — UI에서 안내 문구를 띄울 때 쓴다 */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}

let _app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null
let _storage: FirebaseStorage | null = null

function getApp(): FirebaseApp {
  if (_app) return _app
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase 환경변수가 설정되지 않았습니다. .env.local.example 을 복사해 .env.local 을 만들고 값을 채워주세요.'
    )
  }
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  return _app
}

export function getAuthClient(): Auth {
  if (!_auth) _auth = getAuth(getApp())
  return _auth
}

export function getDb(): Firestore {
  if (_db) return _db
  const app = getApp()
  try {
    // undefined 필드 자동 무시 — 옵셔널 필드를 빈 값으로 둘 수 있도록
    _db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  } catch {
    // 이미 초기화된 경우(HMR 등)
    _db = getFirestore(app)
  }
  return _db
}

export function getStorageClient(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getApp())
  return _storage
}

/** Firestore 컬렉션 이름 — iLINE과 충돌하지 않도록 접두어 고정 */
export const COL = {
  users: 'support_users',
  programs: 'support_programs',
  applications: 'support_applications',
  /**
   * 중복 신청 차단용 **열쇠 문서** — `{uid}_{programId}` 하나당 한 개.
   * 내용은 거의 없고 **존재 자체가 잠금**이다. 규칙에서 생성만 허용하므로,
   * 같은 사람이 같은 프로그램에 두 번째 열쇠를 만들려 하면 거부된다.
   */
  applicationKeys: 'support_application_keys',
  settlements: 'support_settlements',
  outputs: 'support_outputs',
  notices: 'support_notices',
  resources: 'support_resources',
} as const

/** Storage 경로 접두어 */
export const STORAGE_ROOT = 'support'
