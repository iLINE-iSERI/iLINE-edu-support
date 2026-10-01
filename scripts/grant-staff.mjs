/**
 * 담당자 권한 부여 / 회수 — Firestore role + Storage 권한(Custom Claims)을 한 번에
 *
 *   node scripts/grant-staff.mjs --env <이메일> --reason "사유"              ← .env.local 의 서비스 계정 사용 (권장)
 *   node scripts/grant-staff.mjs <서비스계정.json> <이메일> --reason "사유"   ← 키 파일로
 *   … [--revoke]                                                            ← 회수 (role 을 applicant 로, claims 삭제)
 *
 * 📌 10-02 (D-120) 부터 **평소에는 사이트 「회원 관리」에서** 한다(회원을 펼친 맨 아래 「담당자 권한」).
 *    이 도구는 **비상용** — 로그인할 수 있는 담당자가 아무도 없을 때 등.
 *    화면과 같이 **사유가 필수**이고, 역할이 바뀌면 같은 기록함(`support_role_changes`)에
 *    「관리 도구」로 남긴다. 이메일 인증·자기 회수 같은 화면의 막음은 여기엔 없다(비상용이라) —
 *    인증 안 된 계정이면 경고만 한다.
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
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// --reason 은 값을 하나 받는다 — 「--reason "사유"」 또는 「--reason=사유」
const rawArgs = process.argv.slice(2)
const args = []
let reason = ''
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a === '--reason') {
    reason = String(rawArgs[++i] ?? '').trim()
  } else if (a.startsWith('--reason=')) {
    reason = a.slice('--reason='.length).trim()
  } else {
    args.push(a)
  }
}
const revoke = args.includes('--revoke')
const useEnv = args.includes('--env')
const positional = args.filter((a) => !a.startsWith('--'))
const keyPath = useEnv ? null : positional[0]
const email = useEnv ? positional[0] : positional[1]
// 화면과 같은 상한 (lib/types ROLE_REASON_MAX)
const REASON_MAX = 200

if (!email || (!useEnv && !keyPath) || !reason || reason.length > REASON_MAX) {
  console.error('사용법:')
  console.error('  node scripts/grant-staff.mjs --env <이메일> --reason "사유" [--revoke]              (.env.local 의 값 사용)')
  console.error('  node scripts/grant-staff.mjs <서비스계정.json> <이메일> --reason "사유" [--revoke]')
  if (!reason) console.error('❌ 사유(--reason)가 없습니다 — 지정·회수 기록에 남습니다.')
  if (reason.length > REASON_MAX) console.error(`❌ 사유는 ${REASON_MAX}자까지입니다.`)
  console.error('📌 평소에는 사이트 「회원 관리」 → 회원 펼치기 → 「담당자 권한」에서 하세요. 이 도구는 비상용입니다.')
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
  if (!revoke && !user.emailVerified) {
    console.warn(`⚠️ 이메일 인증이 안 된 계정입니다: ${email} — 사이트 화면에서는 지정이 막힙니다(비상용이라 계속합니다).`)
  }

  // 역할 + 기록을 한 번에 — 역할이 그대로면 기록은 남기지 않고 아래 ② 만 다시 맞춘다
  const from = snap.get('role') ?? 'applicant'
  const to = revoke ? 'applicant' : 'staff'
  const batch = db.batch()
  batch.update(ref, { role: to })
  if (from !== to) {
    batch.create(db.collection('support_role_changes').doc(), {
      uid: user.uid,
      from,
      to,
      by: null,
      via: 'script',
      reason,
      at: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()

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
  console.log(from !== to ? `   기록에 남겼습니다 (사유: ${reason})` : '   역할은 이미 그대로였습니다 — 첨부 열람 권한만 다시 맞췄습니다(기록 없음).')
  console.log('   해당 계정은 사이트를 새로고침하면 적용됩니다.')
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
