/**
 * 시험 데이터 정리 (D-51)
 *
 *   node scripts/reset-test-data.mjs <서비스계정.json>            ← 목록만 보기
 *   node scripts/reset-test-data.mjs <서비스계정.json> --delete   ← 실제 삭제
 *   node scripts/reset-test-data.mjs --env [--delete]             ← 키 파일 대신 .env.local 의 값 사용
 *
 *   `--env` (09-12 추가): 키 파일이 어디 있는지 헷갈릴 때. .env.local 에는
 *   시트 연동용으로 같은 서비스 계정의 값(FIREBASE_PROJECT_ID ·
 *   FIREBASE_CLIENT_EMAIL · FIREBASE_PRIVATE_KEY)이 이미 들어 있으므로
 *   그걸 그대로 씁니다. 키 파일을 새로 만들 필요가 없습니다.
 *
 * ── 이 스크립트가 있는 이유 ────────────────────────────────
 * 한 사람의 흔적이 **다섯 곳**에 나뉘어 있습니다. 콘솔에서 손으로 지우면
 * 그중 하나(특히 `support_application_keys`)를 빠뜨리기 쉽고, 빠뜨리면
 * **그 사람이 다시 신청할 수 없는** 상태가 됩니다. 순서도 중요합니다 —
 * 계정을 먼저 지우면 uid 를 잃어 나머지를 찾지 못합니다.
 * 그 순서를 코드로 굳혀 둔 것이 이 파일입니다.
 *   자세한 배경: docs/1-운영/04-테스트용-데이터-정리방법.md
 *
 * ⚠️ **운영이 시작된 뒤에는 쓰면 안 됩니다.** 신청 기록은 보존 의무가 있고,
 *    탈퇴는 삭제가 아니라 상태 변경으로 처리합니다.
 *    실수 방지용으로 두 가지 잠금을 걸어 두었습니다:
 *      ① 아무 옵션 없이 실행하면 **목록만** 보여주고 끝납니다
 *      ② `--delete` 를 붙여도 화면에 `delete` 를 **직접 타이핑**해야 지웁니다
 *
 * 🔒 서비스 계정 키는 프로젝트 전체 권한을 가진 마스터키입니다.
 *    저장소 밖에 두시고, 채팅·메일에 붙여 넣지 마세요.
 *
 * ── 옵션 ───────────────────────────────────────────────
 *   --delete            실제로 지웁니다 (기본은 목록만)
 *   --only <이메일>     **이 사람 것만** 건드립니다 (여러 번 쓸 수 있음)
 *   --keep-accounts     계정·회원 문서는 **한 건도** 안 지웁니다
 *                       (신청 기록만 지우고 같은 계정으로 다시 신청해 볼 때)
 *   --keep <이메일>     이 계정은 남깁니다 (여러 번 쓸 수 있음)
 *   --all               담당자 계정까지 **전부** 지웁니다
 *                       (기본은 `role: staff` 회원을 자동으로 남깁니다.
 *                        담당자를 지우면 권한 부여를 처음부터 다시 해야 합니다)
 *   --programs          `test-` 로 시작하는 **프로그램 공고**도 지웁니다
 *   --bucket <이름>     Storage 버킷 이름 (기본: .env.local 에서 읽음)
 *
 * ⚠️ 옵션을 설계한 원칙: **옵션은 지우는 범위를 넓히지 않고 좁히기만 한다.**
 *    (`--all` 과 `--programs` 만 예외이고, 둘 다 이름이 그렇게 읽힙니다.)
 *    그래서 옵션을 잘못 붙여서 더 많이 지워지는 일은 없습니다.
 *
 * ── 자주 쓰는 조합 ─────────────────────────────────────
 *   목록만 보기          (옵션 없음)
 *   한 사람만 통째로     --only test1@example.com --delete
 *   신청 기록만 비우기   --keep-accounts --delete
 *   한 사람의 신청만     --only test1@example.com --keep-accounts --delete
 *   접수 개시 직전 청소  --delete   (담당자는 자동으로 남습니다)
 */

import { readFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

/* ── 컬렉션 이름 — lib/firebase/config.ts 의 COL 과 같아야 합니다 ───── */
const COL = {
  users: 'support_users',
  programs: 'support_programs',
  applications: 'support_applications',
  applicationKeys: 'support_application_keys',
  settlements: 'support_settlements',
  outputs: 'support_outputs',
  // 시설 예약 (09-12 추가) — 예약 + 슬롯 잠금 + 하루 열쇠 세 곳
  reservations: 'support_reservations',
  reservationSlots: 'support_reservation_slots',
  reservationDays: 'support_reservation_days',
  // 행정실 전달 기록 — 전체 청소 때만 지운다 (`--only` 때는 남김: 여러 사람 건이 섞여 있다).
  // 예약 **운영 설정**(support_reservation_settings)은 시험 기록이 아니라 설정이므로 건드리지 않는다.
  reservationDeliveries: 'support_reservation_deliveries',
}

/** Storage 에서 통째로 비울 자리 (lib 의 STORAGE_ROOT = 'support') */
const STORAGE_PREFIXES = [
  'support/applications/',
  'support/settlements/',
  'support/outputs/',
]

/* ── 명령줄 읽기 ──────────────────────────────────────────── */

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const useEnv = has('--env')
const keyPath = useEnv ? null : argv[0]
const valueOf = (flag) => {
  const out = []
  argv.forEach((a, i) => {
    if (a === flag && argv[i + 1]) out.push(argv[i + 1])
  })
  return out
}

const doDelete = has('--delete')
const keepStaff = !has('--all')
const alsoPrograms = has('--programs')
const keepAccounts = has('--keep-accounts')
const keepEmails = valueOf('--keep').map((e) => e.trim().toLowerCase())
const onlyEmails = valueOf('--only').map((e) => e.trim().toLowerCase())

if (!useEnv && (!keyPath || keyPath.startsWith('--'))) {
  console.error('사용법: node scripts/reset-test-data.mjs <서비스계정.json> [--delete]')
  console.error('        node scripts/reset-test-data.mjs --env [--delete]   (.env.local 의 값 사용)')
  console.error('        (옵션 설명은 이 파일 맨 위 주석에 있습니다)')
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
const envLocal = readEnvLocal()

let credential
if (useEnv) {
  // 시트 연동(lib/server/env.ts)과 같은 이름을 쓴다. 예전 예시 파일의
  // FIREBASE_ADMIN_* 이름도 받아 준다.
  const projectId = envLocal.FIREBASE_PROJECT_ID || envLocal.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = envLocal.FIREBASE_CLIENT_EMAIL || envLocal.FIREBASE_ADMIN_CLIENT_EMAIL
  const rawKey = envLocal.FIREBASE_PRIVATE_KEY || envLocal.FIREBASE_ADMIN_PRIVATE_KEY
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
    console.error('   경로가 맞는지, JSON 파일이 맞는지 확인해 주세요.')
    console.error('   키 파일이 어디 있는지 모르시면 --env 로 실행해 보세요 (.env.local 의 값 사용).')
    process.exit(1)
  }
}

/** 버킷 이름 — 옵션이 없으면 .env.local 에서 찾는다 */
function bucketName() {
  const given = valueOf('--bucket')[0]
  if (given) return given
  return envLocal.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || null
}

const bucket = bucketName()
if (!bucket) {
  console.error('❌ Storage 버킷 이름을 찾지 못했습니다.')
  console.error('   저장소 폴더에서 실행하시거나, --bucket <이름> 을 붙여 주세요.')
  process.exit(1)
}

initializeApp({ credential, storageBucket: bucket })
const db = getFirestore()
const auth = getAuth()

/* ── 지금 무엇이 있는지 조사 ──────────────────────────────── */

console.log('\n🔎 지금 들어 있는 것을 조사합니다…\n')

// 회원 — 담당자를 가려내야 하므로 내용까지 읽는다
const userSnap = await db.collection(COL.users).get()
const users = userSnap.docs.map((d) => ({
  uid: d.id,
  email: (d.data().email || '').toLowerCase(),
  name: d.data().name || '',
  role: d.data().role || 'member',
}))

// 로그인 계정 (회원 문서가 없는 '가입 1단계만 한' 계정까지 잡기 위해)
const accounts = []
let pageToken
do {
  const page = await auth.listUsers(1000, pageToken)
  page.users.forEach((u) =>
    accounts.push({ uid: u.uid, email: (u.email || '').toLowerCase() })
  )
  pageToken = page.pageToken
} while (pageToken)

/* ── --only : 특정 사람만 대상으로 좁힌다 ──────────────────
   이 옵션이 붙으면 **그 사람 것 말고는 아무것도** 건드리지 않는다. */
let onlyUids = null
if (onlyEmails.length > 0) {
  onlyUids = new Set()
  const notFound = []
  onlyEmails.forEach((email) => {
    const hits = [
      ...users.filter((u) => u.email === email),
      ...accounts.filter((a) => a.email === email),
    ]
    if (hits.length === 0) notFound.push(email)
    hits.forEach((h) => onlyUids.add(h.uid))
  })
  if (notFound.length > 0) {
    console.error(`❌ 그런 이메일의 계정이 없습니다: ${notFound.join(', ')}`)
    console.error('   철자를 확인해 주세요. 아무것도 지우지 않았습니다.')
    process.exit(1)
  }
}

const inScope = (uid) => (onlyUids ? onlyUids.has(uid) : true)

const keepUids = new Set()
users.forEach((u) => {
  if (keepStaff && u.role === 'staff') keepUids.add(u.uid)
  if (keepEmails.includes(u.email)) keepUids.add(u.uid)
})
accounts.forEach((a) => {
  if (keepEmails.includes(a.email)) keepUids.add(a.uid)
})

// --keep-accounts 면 계정·회원 문서는 한 건도 지우지 않는다.
// (같은 계정으로 신청을 다시 해 보고 싶을 때 쓰는 길)
const usersToDelete = keepAccounts
  ? []
  : users.filter((u) => !keepUids.has(u.uid) && inScope(u.uid))
const accountsToDelete = keepAccounts
  ? []
  : accounts.filter((a) => !keepUids.has(a.uid) && inScope(a.uid))

/* ── 지울 문서 모으기 ─────────────────────────────────────
   `--only` 가 붙으면 그 사람 것만 고른다. 신청서·정산·산출물은
   문서에 `uid` 가 들어 있고, 열쇠 문서는 ID 자체가 `{uid}_{프로그램}` 이다. */

/** uid 로 걸러낸 문서 ID 목록 */
async function idsOf(name) {
  if (!onlyUids) {
    const snap = await db.collection(name).select().get()
    return snap.docs.map((d) => d.id)
  }
  const out = []
  for (const uid of onlyUids) {
    const snap = await db.collection(name).where('uid', '==', uid).select().get()
    snap.docs.forEach((d) => out.push(d.id))
  }
  return out
}

/** 열쇠 문서는 uid 필드가 없을 수 있으므로 **ID 앞부분**으로 고른다 */
async function keyIdsOf() {
  const snap = await db.collection(COL.applicationKeys).select().get()
  return snap.docs
    .map((d) => d.id)
    .filter((id) => !onlyUids || [...onlyUids].some((uid) => id.startsWith(`${uid}_`)))
}

/** 하루 열쇠도 ID 가 `{uid}_…` 라 앞부분으로 고른다 */
async function dayKeyIdsOf() {
  const snap = await db.collection(COL.reservationDays).select().get()
  return snap.docs
    .map((d) => d.id)
    .filter((id) => !onlyUids || [...onlyUids].some((uid) => id.startsWith(`${uid}_`)))
}

/** 슬롯 문서에는 uid 가 없다(회원끼리 보이는 문서라 일부러 뺐다) — 예약 ID 로 고른다 */
async function slotIdsOf(reservationIds) {
  const snap = await db.collection(COL.reservationSlots).select('reservationId').get()
  const want = new Set(reservationIds)
  return snap.docs
    .filter((d) => !onlyUids || want.has(d.get('reservationId')))
    .map((d) => d.id)
}

const [appIds, keyIds, settleIds, outputIds, reservationIds, dayKeyIds] = await Promise.all([
  idsOf(COL.applications),
  keyIdsOf(),
  idsOf(COL.settlements),
  idsOf(COL.outputs),
  idsOf(COL.reservations),
  dayKeyIdsOf(),
])
const slotIds = await slotIdsOf(reservationIds)
/** 전달 기록 — 전체 청소일 때만. 남겨두면 「지난 전달: 새 요청 N건」이 유령처럼 남는다 */
const deliveryIds = onlyUids ? [] : (await db.collection(COL.reservationDeliveries).select().get()).docs.map((d) => d.id)

/** Storage 에서 비울 자리 — `--only` 면 그 사람 폴더만 */
const storageTargets = onlyUids
  ? [...onlyUids].flatMap((uid) => STORAGE_PREFIXES.map((p) => `${p}${uid}/`))
  : STORAGE_PREFIXES

let testPrograms = []
if (alsoPrograms && !onlyUids) {
  const snap = await db.collection(COL.programs).select('title').get()
  testPrograms = snap.docs
    .filter((d) => d.id.startsWith('test-'))
    .map((d) => ({ id: d.id, title: d.get('title') || '' }))
}

/* ── 무엇을 지울지 보여준다 ───────────────────────────────── */

/**
 * 터미널에서 한글은 **두 칸**을 차지한다. `padEnd` 는 글자 수로만 세기
 * 때문에 한글 이름표 뒤의 숫자가 들쭉날쭉해진다(09-12 iSERI 지적).
 * 화면 폭으로 세서 채운다.
 */
function displayWidth(str) {
  let w = 0
  for (const ch of str) {
    const c = ch.codePointAt(0)
    const wide =
      (c >= 0x1100 && c <= 0x115f) || // 한글 자모
      (c >= 0x2e80 && c <= 0xa4cf) || // CJK · 한글 호환 자모 등
      (c >= 0xac00 && c <= 0xd7a3) || // 한글 음절
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) || // 전각
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x1f300 && c <= 0x1faff) // 이모지
    w += wide ? 2 : 1
  }
  return w
}
const padRight = (str, width) => str + ' '.repeat(Math.max(0, width - displayWidth(str)))
const padLeft = (str, width) => ' '.repeat(Math.max(0, width - displayWidth(str))) + str

const line = (label, n) =>
  console.log(`   ${padRight(label, 34)} ${padLeft(String(n), 5)} 건`)

if (onlyUids) {
  console.log('🎯 대상을 좁혔습니다 — 아래 사람 것만 건드립니다')
  onlyEmails.forEach((e) => {
    const u = users.find((x) => x.email === e)
    console.log(`   ${padRight(e, 36)} ${u?.name || '(회원 등록 미완료)'}`)
  })
  console.log('')
}

console.log('📦 지울 것')
// 구분선·이름표에 '·' '─' 같은 기호를 쓰지 않는다 — 윈도우 터미널(CP949)에서는
// 이런 기호가 두 칸으로 나와 줄이 어긋난다.
console.log(`   ${'-'.repeat(42)}`)
line('신청서', appIds.length)
line('중복 신청 열쇠', keyIds.length)
line('정산', settleIds.length)
line('산출물', outputIds.length)
line('시설 예약 (취소 기록 포함)', reservationIds.length)
line('예약 자리 잠금 + 하루 열쇠', slotIds.length + dayKeyIds.length)
if (!onlyUids) line('행정실 전달 기록', deliveryIds.length)
line('회원 문서', usersToDelete.length)
line('로그인 계정', accountsToDelete.length)
if (alsoPrograms && !onlyUids) line('시험용 공고 (test-)', testPrograms.length)
console.log(`   Storage: ${storageTargets.join(', ')} 아래`)

if (keepAccounts) {
  console.log('\n🛟 --keep-accounts — 계정과 회원 문서는 **한 건도** 지우지 않습니다.')
  console.log('   같은 계정으로 신청을 다시 해 보실 수 있습니다.')
}
if (alsoPrograms && onlyUids) {
  console.log('\n📌 --only 와 함께라면 --programs 는 무시됩니다 (공고는 특정인의 것이 아니므로).')
}

// ⚠️ 건수만 보여주면 "10건"이 머리에 안 들어온다.
//    **지워질 계정을 이름과 함께** 늘어놓아야 실감이 난다 (09-09 경험).
if (accountsToDelete.length > 0) {
  console.log('\n🗑️ 사라질 계정 — 되돌릴 수 없습니다')
  accountsToDelete.forEach((a) => {
    const u = users.find((x) => x.uid === a.uid)
    console.log(`   ${padRight(a.email || '(이메일 없음)', 36)} ${u?.name || '(회원 등록 미완료)'}`)
  })
}

if (!keepAccounts) {
  if (keepUids.size > 0) {
    console.log('\n🛟 남길 계정')
    ;[...keepUids].forEach((uid) => {
      const u = users.find((x) => x.uid === uid)
      const a = accounts.find((x) => x.uid === uid)
      const why = u?.role === 'staff' ? '담당자' : '--keep 지정'
      console.log(`   ${padRight(u?.email || a?.email || uid, 36)} ${u?.name || ''} (${why})`)
    })
  } else {
    console.log('\n⚠️ 남기는 계정이 없습니다 — 담당자 권한을 처음부터 다시 만드셔야 합니다.')
  }
}

if (!alsoPrograms) {
  console.log('\n📌 공고·공지는 건드리지 않습니다.')
  console.log('   시험용 공고까지 지우시려면 --programs 를 붙이세요 (id 가 test- 로 시작하는 것만).')
}
console.log('\n📌 구글 시트와 드라이브의 사본은 여기서 지워지지 않습니다.')
console.log('   스프레드시트의 줄과 드라이브 `01_신청` 폴더는 따로 지우세요.')
console.log('   ⚠️ 시트를 비우실 때는 **머리글(첫 줄)까지** 지워야 새 머리글이 들어갑니다.')

if (!doDelete) {
  console.log('\n✋ 목록만 보여드렸습니다. 아무것도 지우지 않았습니다.')
  console.log('   실제로 지우시려면 끝에 --delete 를 붙여 다시 실행하세요.')
  process.exit(0)
}

/* ── 두 번째 잠금 — 직접 타이핑해야 지운다 ────────────────── */

if (appIds.length > 100 || accountsToDelete.length > 50) {
  console.log('\n🛑 건수가 시험 단계치고 많습니다. 운영 데이터가 아닌지 확인하세요.')
  console.log('   운영이 시작된 뒤에는 이 스크립트를 쓰면 안 됩니다.')
}

if (!process.stdin.isTTY) {
  console.error('\n❌ 확인 입력을 받을 수 없는 환경입니다. 터미널에서 직접 실행해 주세요.')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
if (accountsToDelete.length > 0) {
  console.log(
    `\n⚠️ 계정 ${accountsToDelete.length}개가 **영구히** 사라집니다. ` +
      '되돌리는 방법은 없습니다 — 시험 계정이라면 다시 가입하시면 됩니다.'
  )
} else {
  console.log('\n🛟 사라지는 계정은 없습니다. 기록만 지웁니다.')
}
const answer = await rl.question('정말 지우시겠습니까? 지우려면 delete 를 입력하세요: ')
rl.close()
if (answer.trim() !== 'delete') {
  console.log('취소했습니다. 아무것도 지우지 않았습니다.')
  process.exit(0)
}

/* ── 지운다 — 순서가 중요하다 ─────────────────────────────── */

/** 문서 여러 개를 나눠서 지운다 (한 번에 500개 제한) */
async function deleteDocs(name, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch()
    ids.slice(i, i + 400).forEach((id) => batch.delete(db.collection(name).doc(id)))
    await batch.commit()
  }
}

console.log('\n① Storage 파일…')
for (const prefix of storageTargets) {
  await getStorage().bucket().deleteFiles({ prefix, force: true })
  console.log(`   ${prefix} 비움`)
}

console.log('② 신청서…')
await deleteDocs(COL.applications, appIds)

console.log("②′ 중복 신청 열쇠… (이걸 빠뜨리면 '이미 신청했다'가 풀리지 않습니다)")
await deleteDocs(COL.applicationKeys, keyIds)

console.log('②″ 정산 · 산출물…')
await deleteDocs(COL.settlements, settleIds)
await deleteDocs(COL.outputs, outputIds)

console.log("②‴ 시설 예약 · 자리 잠금 · 하루 열쇠… (잠금을 빠뜨리면 그 자리가 영영 '다 참'으로 남습니다)")
await deleteDocs(COL.reservations, reservationIds)
await deleteDocs(COL.reservationSlots, slotIds)
await deleteDocs(COL.reservationDays, dayKeyIds)
if (deliveryIds.length > 0) {
  console.log('② 행정실 전달 기록… (예약 운영 설정은 남깁니다)')
  await deleteDocs(COL.reservationDeliveries, deliveryIds)
}

console.log('③ 회원 문서…')
await deleteDocs(COL.users, usersToDelete.map((u) => u.uid))

if (alsoPrograms && !onlyUids && testPrograms.length > 0) {
  console.log('③′ 시험용 공고…')
  await deleteDocs(COL.programs, testPrograms.map((p) => p.id))
}

console.log('④ 로그인 계정…')
for (let i = 0; i < accountsToDelete.length; i += 1000) {
  const chunk = accountsToDelete.slice(i, i + 1000).map((a) => a.uid)
  const res = await auth.deleteUsers(chunk)
  if (res.failureCount > 0) {
    console.log(`   ⚠️ ${res.failureCount}개 실패:`)
    res.errors.forEach((e) => console.log(`      ${chunk[e.index]} — ${e.error.message}`))
  }
}

console.log('\n✅ 정리했습니다.\n')
console.log('확인하실 것:')
console.log('  □ 남긴 담당자 계정으로 로그인 → 마이페이지에 신청 내역이 비어 있다')
console.log('  □ 담당자 화면에 신청 건이 없다')
console.log('  □ 헤더에 [담당자] 가 그대로 보인다 (안 보이면 회원 문서를 잘못 지운 것)')
console.log('  □ 구글 시트와 드라이브의 시험 줄·파일은 따로 지웠다')
