/**
 * 담당자 권한 부여 / 회수 — Firestore role + Storage 권한(Custom Claims)을 한 번에
 *
 *   node scripts/grant-staff.mjs --env <이메일>                ← .env.local 의 서비스 계정 사용 (권장)
 *   node scripts/grant-staff.mjs <서비스계정.json> <이메일>     ← 키 파일로
 *   … [--revoke]                                              ← 회수 (role 을 applicant 로, claims 삭제)
 *
 * 09-18 (D-93 뒤): 두 가지를 한 번에 한다.
 *   ① Firestore `support_users/{uid}.role` 을 'staff' 로 — 사이트 「관리」 화면
 *   ② Custom Claims `supportStaff: true` — Storage 첨부 파일·PDF 열람
 * 예전에는 ①을 콘솔에서 손으로 했는데, 담당자가 늘면 한쪽만 하고 잊는다.
 * `--env` 는 정리 스크립트(09-12)와 같은 방식 — 키 파일을 새로 만들 필요가 없다
 * (키가 둘이 되고, 옛 키를 지우면 Vercel 의 시트 연동이 멈춘다).
 *
 * 🔒 서비스 계정 키는 프로젝트 전체 권한을 가진 마스터키입니다.
 *    Git 에 커밋하지 마시고, 이 폴더 밖에 보관하세요.
 *
 * 회수할 때는 이것 말고 **구글 시트·공유 드라이브 공유 해제**도 따로 해야 합니다
 * (docs/1-운영/03-담당자-권한-부여.md).
 */

import { readFileSync, existsSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const useEnv = args.includes('--env')
const positional = args.filter((a) => !a.startsWith('--'))
const keyPath = useEnv ? null : positional[0]
const email = useEnv ? positional[0] : positional[1]

if (!email || (!useEnv && !keyPath)) {
  console.error('사용법:')
  console.error('  node scripts/grant-staff.mjs --env <이메일> [--revoke]              (.env.local 의 값 사용)')
  console.error('  node scripts/grant-staff.mjs <서비스계정.json> <이메일> [--revoke]')
  process.exit(1)
}

/** .env.local 을 줄 단위로 읽어 { 이름: 값 } 으로 — 따옴표는 벗긴다 */
function readEnvLocal() {
  if (!existsSync('.env.local')) return {}
  const out = {}
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) return
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    })
  return out
}

let credential
if (useEnv) {
  const env = readEnvLocal()
  const projectId = env.FIREBASE_PROJECT_ID || env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_ADMIN_CLIENT_EMAIL
  const rawKey = env.FIREBASE_PRIVATE_KEY || env.FIREBASE_ADMIN_PRIVATE_KEY
  if (!projectId || !clientEmail || !rawKey) {
    console.error('❌ .env.local 에 FIREBASE_PROJECT_ID · FIREBASE_CLIENT_EMAIL · FIREBASE_PRIVATE_KEY 가 없습니다.')
    console.error('   저장소 폴더에서 실행 중인지 확인하시고, 없으면 키 파일 경로로 실행해 주세요.')
    process.exit(1)
  }
  credential = cert({ projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, '\n') })
  console.log(`🔑 .env.local 의 서비스 계정을 씁니다: ${clientEmail}`)
} else {
  try {
    credential = cert(JSON.parse(readFileSync(keyPath, 'utf8')))
  } catch {
    console.error(`❌ 서비스 계정 키를 읽지 못했습니다: ${keyPath}`)
    console.error('   경로가 맞는지, JSON 파일이 맞는지 확인해 주세요. 키 파일이 없으면 --env 로 실행하세요.')
    process.exit(1)
  }
}

initializeApp({ credential })

try {
  const user = await getAuth().getUserByEmail(email)

  // ① Firestore role — 회원 문서가 없으면(가입 2단계를 안 마침) 멈춘다
  const db = getFirestore()
  const ref = db.collection('support_users').doc(user.uid)
  const snap = await ref.get()
  if (!snap.exists) {
    console.error(`❌ 회원 문서가 없습니다: ${email}`)
    console.error('   사이트에서 회원가입 2단계(참여 정보)까지 마쳐야 합니다.')
    process.exit(1)
  }
  await ref.update({ role: revoke ? 'applicant' : 'staff' })

  // ② Custom Claims — 기존 claims 를 보존한 채 하나만 바꾼다. 통째로 덮어쓰면
  //    나중에 다른 권한이 생겼을 때 조용히 지워진다.
  const claims = { ...(user.customClaims || {}) }
  if (revoke) delete claims.supportStaff
  else claims.supportStaff = true
  await getAuth().setCustomUserClaims(user.uid, claims)

  console.log(
    revoke
      ? `✅ 담당자 권한을 회수했습니다: ${email}  (role → applicant · 첨부 열람 권한 삭제)`
      : `✅ 담당자 권한을 부여했습니다: ${email}  (role → staff · 첨부 열람 권한)`
  )
  console.log('   해당 계정은 로그아웃 뒤 다시 로그인해야 적용됩니다.')
  if (revoke) console.log('   ⚠️ 구글 시트·공유 드라이브 공유 해제는 따로 해야 합니다.')
} catch (e) {
  if (e?.code === 'auth/user-not-found') {
    console.error(`❌ 그런 이메일의 계정이 없습니다: ${email}`)
    console.error('   먼저 사이트에서 회원가입을 마쳐야 합니다.')
  } else {
    console.error('❌ 실패:', e?.message || e)
  }
  process.exit(1)
}
