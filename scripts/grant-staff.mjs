/**
 * 담당자 Storage 권한 부여 / 회수
 *
 *   node scripts/grant-staff.mjs <서비스계정.json> <이메일> [--revoke]
 *
 * Firestore 의 role 필드와는 **별개**입니다. 자세한 배경은
 * docs/08-staff-setup.md 를 보세요.
 *
 * 🔒 서비스 계정 키는 프로젝트 전체 권한을 가진 마스터키입니다.
 *    Git 에 커밋하지 마시고, 이 폴더 밖에 보관하세요.
 */

import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [keyPath, email, ...rest] = process.argv.slice(2)
const revoke = rest.includes('--revoke')

if (!keyPath || !email) {
  console.error(
    '사용법: node scripts/grant-staff.mjs <서비스계정.json> <이메일> [--revoke]'
  )
  process.exit(1)
}

let credential
try {
  credential = cert(JSON.parse(readFileSync(keyPath, 'utf8')))
} catch (e) {
  console.error(`❌ 서비스 계정 키를 읽지 못했습니다: ${keyPath}`)
  console.error('   경로가 맞는지, JSON 파일이 맞는지 확인해 주세요.')
  process.exit(1)
}

initializeApp({ credential })

try {
  const user = await getAuth().getUserByEmail(email)

  // 기존 claims 를 보존한 채 하나만 바꾼다. 통째로 덮어쓰면
  // 나중에 다른 권한이 생겼을 때 조용히 지워진다.
  const claims = { ...(user.customClaims || {}) }
  if (revoke) delete claims.supportStaff
  else claims.supportStaff = true

  await getAuth().setCustomUserClaims(user.uid, claims)

  console.log(
    revoke
      ? `✅ 담당자 권한을 회수했습니다: ${email}`
      : `✅ 담당자 권한을 부여했습니다: ${email}`
  )
  console.log('   해당 계정은 다시 로그인해야 적용됩니다.')
} catch (e) {
  if (e?.code === 'auth/user-not-found') {
    console.error(`❌ 그런 이메일의 계정이 없습니다: ${email}`)
    console.error('   먼저 사이트에서 회원가입을 마쳐야 합니다.')
  } else {
    console.error('❌ 실패:', e?.message || e)
  }
  process.exit(1)
}
