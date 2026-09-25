/**
 * 시트 줄 점검 — **읽기만 한다. 아무것도 고치지 않는다.** (D-109 · 09-25)
 *
 *   node scripts/check-sheet-rows.mjs --env      ← .env.local 의 서비스 계정 사용 (권장)
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────
 * 사이트는 신청·정산·산출물·문의를 구글 시트에 한 줄씩 쓰고, **쓴 줄 번호를 각 문서에
 * 기억해 둔다**(`sheetRowId`). 다음에 상태가 바뀌거나 수정되면 **그 번호의 줄을 확인 없이
 * 덮어쓴다.** 그런데 담당자가 시트에서 **행을 삭제**하면 아래 줄이 위로 당겨져 번호가
 * 어긋나고, 줄 **내용을 비우면** 새 신청이 그 빈 줄로 들어와 두 문서가 같은 번호를
 * 기억하게 된다. 둘 다 **시트만 봐서는 알 수 없다** — 기억한 번호는 Firebase 에 있다.
 * 이 도구가 둘을 대조한다.
 *
 * ── 무엇을 보여 주나 (탭마다) ───────────────────────────────────
 *   ❌ 어긋남   — 문서가 기억한 줄의 A열이 **자기 번호가 아니다.**
 *                 이 문서가 다시 동기화되면 **그 줄(다른 사람)을 덮어쓴다**
 *   ⚠️ 겹침    — 두 문서 이상이 **같은 줄 번호**를 기억한다
 *   ⚠️ 중복    — 시트에 **같은 번호가 두 번 이상** 있다 (한 사람이 두 줄)
 *   ⚠️ 빠짐    — Firebase 에 있는데 **시트 A열 어디에도 번호가 없다**
 *   ℹ️ 시트에만 — 시트에는 있는데 Firebase 에 없는 번호 (지워진 시험 건 등)
 *
 * 🔒 이름은 **가려서** 찍는다(김*수). 결과를 채팅에 붙여 넣어도 개인정보가 덜 나간다.
 *    서비스 계정 키는 읽기만 하고 화면에 찍지 않는다.
 */

import { readFileSync, existsSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

if (!process.argv.includes('--env')) {
  console.error('사용법:  node scripts/check-sheet-rows.mjs --env')
  console.error('         (저장소 폴더에서, .env.local 의 서비스 계정으로 읽기만 합니다)')
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
const sheetId = env.SHEET_ID
if (!projectId || !clientEmail || !rawKey || !sheetId) {
  console.error('❌ .env.local 에 FIREBASE_PROJECT_ID · FIREBASE_CLIENT_EMAIL · FIREBASE_PRIVATE_KEY · SHEET_ID 가 필요합니다.')
  process.exit(1)
}
const privateKey = rawKey.replace(/\\n/g, '\n')

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()
const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  // 읽기 전용 범위 — 실수로도 쓰지 못하게
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const sheets = google.sheets({ version: 'v4', auth })

/** 김철수 → 김*수, 이영 → 이* */
function mask(name) {
  const s = String(name ?? '').trim()
  if (!s) return '(이름 없음)'
  if (s.length === 1) return s
  if (s.length === 2) return `${s[0]}*`
  return `${s[0]}${'*'.repeat(s.length - 2)}${s[s.length - 1]}`
}

/**
 * 탭 목록 — `tab: null` 은 **첫 번째 탭**(신청). 사이트가 이름이 아니라 위치로 찾는다.
 * A열은 네 탭 모두 **그 문서의 번호**(`id`)다 (lib/server/googleSync.ts 의 row 첫 칸).
 */
const TABS = [
  { label: '신청', tab: null, col: 'support_applications', name: (d) => d.applicant?.name },
  { label: '정산', tab: '정산', col: 'support_settlements', name: (d) => d.applicantName },
  { label: '산출물', tab: '산출물', col: 'support_outputs', name: (d) => d.authorName },
  { label: '문의', tab: '문의', col: 'support_inquiries', name: (d) => d.authorName },
]

const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties.title' })
const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '')
console.log(`📄 시트 탭: ${titles.map((t, i) => (i === 0 ? `${t}(첫 탭 = 신청)` : t)).join(' · ')}\n`)

let problems = 0

for (const t of TABS) {
  const title = t.tab ?? titles[0]
  if (!titles.includes(title)) {
    console.log(`── ${t.label} ── 탭이 없습니다. 건너뜁니다.\n`)
    continue
  }

  // A열 — 인덱스 0 이 1행(머리글)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${title}'!A:A`,
    majorDimension: 'COLUMNS',
  })
  const colA = (res.data.values?.[0] ?? []).map((v) => String(v ?? '').trim())
  const rowsById = new Map()
  colA.forEach((v, i) => {
    if (i === 0 || !v) return
    if (!rowsById.has(v)) rowsById.set(v, [])
    rowsById.get(v).push(i + 1)
  })

  const snap = await db.collection(t.col).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const byRemembered = new Map()

  const wrong = []
  const missing = []
  for (const d of docs) {
    const hint = Number(d.sheetRowId) || 0
    const who = `${d.id} · ${mask(t.name(d))} · ${d.status ?? ''}`
    if (hint > 1) {
      if (!byRemembered.has(hint)) byRemembered.set(hint, [])
      byRemembered.get(hint).push(who)
      const there = colA[hint - 1] ?? ''
      if (there !== d.id) {
        const actual = rowsById.get(d.id)
        wrong.push(
          `   ❌ ${who}\n` +
            `      기억한 줄 ${hint}행 → 그 줄 A열: ${there || '(빈 칸)'}\n` +
            `      실제 자기 줄: ${actual ? actual.join(', ') + '행' : '시트에 없음'}\n` +
            `      → D-109 배포 전이면 다시 동기화될 때 ${hint}행을 덮어씁니다.\n` +
            `        D-109 배포 뒤에는 자기 줄을 찾아 쓰므로 해가 없고, 한 번 동기화되면 번호가 바로잡힙니다`
        )
      }
    }
    if (!rowsById.has(d.id)) missing.push(`   ⚠️ ${who} (기억한 줄: ${hint > 1 ? hint + '행' : '없음'})`)
  }

  const overlap = [...byRemembered.entries()].filter(([, list]) => list.length > 1)
  const dupes = [...rowsById.entries()].filter(([, rows]) => rows.length > 1)
  const ids = new Set(docs.map((d) => d.id))
  const sheetOnly = [...rowsById.entries()].filter(([id]) => !ids.has(id))

  console.log(`── ${t.label} (탭 「${title}」) ──`)
  console.log(`   Firebase 문서 ${docs.length}건 · 시트 데이터 줄 ${[...rowsById.values()].flat().length}줄`)

  if (wrong.length) {
    console.log(`\n   ❌ 기억한 줄이 어긋남 ${wrong.length}건`)
    wrong.forEach((w) => console.log(w))
  }
  if (overlap.length) {
    console.log(`\n   ⚠️ 겹침 — 같은 줄 번호를 여러 문서가 기억합니다`)
    overlap.forEach(([row, list]) => console.log(`   ${row}행 ← ${list.join('  /  ')}`))
  }
  if (dupes.length) {
    console.log(`\n   ⚠️ 중복 — 시트에 같은 번호가 여러 줄`)
    dupes.forEach(([id, rows]) => console.log(`   ${id} → ${rows.join(', ')}행`))
  }
  if (missing.length) {
    console.log(`\n   ⚠️ 빠짐 — 시트에 번호가 없습니다`)
    missing.forEach((m) => console.log(m))
  }
  if (sheetOnly.length) {
    console.log(`\n   ℹ️ 시트에만 있는 번호 (Firebase 에 없음)`)
    sheetOnly.forEach(([id, rows]) => console.log(`   ${id} → ${rows.join(', ')}행`))
  }

  const n = wrong.length + overlap.length + dupes.length + missing.length
  problems += n
  if (n === 0) console.log('   ✅ 어긋난 곳 없음')
  else if (dupes.length === 0 && missing.length === 0) {
    // 덮어쓰기가 일어났다면 한 건이 두 줄(중복)이 되고 다른 한 건이 사라진다(빠짐)
    console.log('\n   ✅ 중복·빠짐은 없음 — 시트 내용은 맞습니다. 아직 덮어쓴 곳은 없습니다')
  }
  console.log('')
}

console.log(
  problems === 0
    ? '✅ 네 탭 모두 기억한 줄 번호와 시트가 맞습니다.'
    : `🔴 확인할 곳 ${problems}건. D-109(A열에서 자기 번호 찾기)가 배포되기 전이면 위 ❌ 건을\n` +
        `   사이트에서 건드리지 마세요(상태 변경·수정·취소·다시 시도). 배포 뒤에는 동기화될 때마다 저절로 바로잡힙니다.`
)
process.exit(0)
