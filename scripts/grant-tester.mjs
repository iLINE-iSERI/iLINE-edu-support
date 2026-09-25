/**
 * 테스트 계정 지정 / 해제 — Firestore `support_users/{uid}.role` 을 'tester' 로 (D-111 · 09-26)
 *
 *   node scripts/grant-tester.mjs --env <이메일>            ← 테스트 계정으로
 *   node scripts/grant-tester.mjs --env <이메일> --revoke   ← 일반 회원으로 되돌리기
 *
 * ── 테스트 계정이 되면 ─────────────────────────────────────────
 *   · 비공개 공고가 `/apply` 목록에 「비공개 · 시험」으로 보이고, 거기에 신청해 볼 수 있다
 *   · 선정되면 정산·산출물도 비공개 공고에서 시험해 볼 수 있다
 *   · **이 계정이 낸 것은 구글 시트·드라이브로 가지 않는다** (담당자 목록에 「시험」)
 *   · 그 밖에는 **일반 회원과 똑같다** — 담당자 화면은 못 들어간다
 *
 * ── grant-staff.mjs 와 다른 점 ─────────────────────────────────
 *   · Storage 권한(Custom Claims)은 **건드리지 않는다** — 테스트 계정은 남의 첨부를 볼 이유가 없다
 *   · 🔴 **담당자 계정은 바꾸지 않고 멈춘다.** `role` 은 하나뿐이라 담당자를 테스트 계정으로
 *     바꾸면 담당자 권한이 사라진다. 테스트 계정은 **따로 만든 계정**으로 한다
 *
 * 🔒 서비스 계정 키(.env.local)는 읽기만 하고 화면에 찍지 않는다.
 */

import { readFileSync, existsSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const email = args.filter((a) => !a.startsWith('--'))[0]

if (!args.includes('--env') || !email) {
  console.error('사용법:')
  console.error('  node scripts/grant-tester.mjs --env <이메일>            (테스트 계정으로)')
  console.error('  node scripts/grant-tester.mjs --env <이메일> --revoke   (일반 회원으로)')
  process.exit(1)
}

/** .env.local 을 줄 단위로 읽어 { 이름: 값 } — grant-staff.mjs 와 같은 방식 */
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

const env = readEnvLocal()
const projectId = env.FIREBASE_PROJECT_ID || env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_ADMIN_CLIENT_EMAIL
const rawKey = env.FIREBASE_PRIVATE_KEY || env.FIREBASE_ADMIN_PRIVATE_KEY
if (!projectId || !clientEmail || !rawKey) {
  console.error('❌ .env.local 에 FIREBASE_PROJECT_ID · FIREBASE_CLIENT_EMAIL · FIREBASE_PRIVATE_KEY 가 없습니다.')
  console.error('   저장소 폴더에서 실행 중인지 확인해 주세요.')
  process.exit(1)
}
initializeApp({ credential: cert({ projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, '\n') }) })

try {
  const user = await getAuth().getUserByEmail(email)
  const ref = getFirestore().collection('support_users').doc(user.uid)
  const snap = await ref.get()
  if (!snap.exists) {
    console.error(`❌ 회원 문서가 없습니다: ${email}`)
    console.error('   사이트에서 회원가입 2단계(참여 정보)까지 마쳐야 합니다.')
    process.exit(1)
  }

  const current = snap.data()?.role ?? 'applicant'
  if (current === 'staff') {
    console.error(`❌ 담당자 계정입니다: ${email} — 바꾸지 않았습니다.`)
    console.error('   role 은 하나뿐이라, 테스트 계정으로 바꾸면 담당자 권한이 사라집니다.')
    console.error('   테스트용 계정을 따로 만들어 지정해 주세요.')
    process.exit(1)
  }

  const next = revoke ? 'applicant' : 'tester'
  if (current === next) {
    console.log(`ℹ️ 이미 ${next === 'tester' ? '테스트 계정' : '일반 회원'}입니다: ${email}`)
    process.exit(0)
  }

  await ref.update({ role: next, updatedAt: new Date() })
  console.log(
    revoke
      ? `✅ 일반 회원으로 되돌렸습니다: ${email}  (role → applicant)`
      : `✅ 테스트 계정으로 지정했습니다: ${email}  (role → tester)`
  )
  console.log('   사이트에서 새로고침하면 바로 적용됩니다.')
  if (!revoke) {
    console.log('   이 계정이 낸 신청·정산·산출물·문의는 구글 시트·드라이브로 가지 않습니다.')
  }
} catch (e) {
  if (e?.code === 'auth/user-not-found') {
    console.error(`❌ 그런 이메일의 계정이 없습니다: ${email}`)
    console.error('   먼저 사이트에서 회원가입을 마쳐야 합니다.')
  } else {
    console.error('❌ 실패:', e?.message || e)
  }
  process.exit(1)
}
process.exit(0)
