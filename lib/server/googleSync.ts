/**
 * 구글 시트·드라이브 동기화 (D-7 / D-9 / D-30) — 서버 전용.
 *
 * 반출 범위는 docs/4-기록/02-시트-드라이브-반출-범위.md 에서 확정한 것만 다룬다.
 * **여기에 열을 추가하기 전에 그 문서를 먼저 고칠 것.**
 * 신분증·통장 사본 등 민감 서류는 이 경로로 절대 나가지 않는다.
 *
 * 원본은 언제나 Firebase 다. 시트와 드라이브는 담당자 편의를 위한 사본이고,
 * 그래서 이 모듈이 실패해도 신청 자체는 이미 완료된 상태여야 한다.
 */

import 'server-only'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { google } from 'googleapis'
import { getGoogleConfig } from './env'
import {
  MEMBER_TYPE_LABEL,
  SETTLEMENT_STATUS_LABEL,
  memberTypeOf,
  identityLine,
  type Application,
  type Settlement,
} from '@/lib/types'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
]

/** 시트 머리글 — docs/4-기록/02-시트-드라이브-반출-범위.md §1 과 일치해야 한다 */
const HEADERS = [
  '신청번호',
  '프로그램명',
  '신청 일시',
  // D-43: 학생만 받던 때는 '학번·전공·학년' 이었는데, 교원·일반이 생기면서
  // 그 열이 절반쯤 빈칸이 된다. 유형에 맞는 값이 들어가도록 이름을 바꿨다.
  '회원 유형',
  '이름',
  '소속',
  '학과·전공',
  '신분',
  '연락처',
  '이메일',
  '개인정보 수집·이용 동의',
  '초상권 활용 동의',
  '상태(사본)',
  '신청서 PDF',
  '추가 기재',
  // D-50: 프로그램 전용 항목. **항목마다 열을 만들지 않는다** —
  // 프로그램이 셋만 되어도 시트가 빈칸투성이가 된다(D-43에서 겪은 일).
  // 한 칸에 `항목: 값` 을 줄바꿈으로 이어 붙인다.
  '프로그램별 기재',
]

/**
 * 한국 시각으로 쪼개기.
 *
 * ⚠️ **서버(Vercel)는 UTC 로 돕니다.** `getHours()` 나 `toLocaleString('ko-KR')` 을
 *    그냥 쓰면 서버 시간대를 따라가 **9시간 이른 값**이 나온다. 새벽 1시 제출이
 *    전날 오후 4시로 기록되므로, **마감 직전 제출이 전날 것**이 된다.
 *    마감 시비가 붙었을 때 근거로 쓸 수 없는 값이 된다. (09-06 실제 발생)
 *
 *    화면 쪽은 브라우저 시간대라 원래 정확했다 — 서버에서 만드는 값만 문제였다.
 *    저장된 `submittedAt` 도 정확했고 **표시만 틀렸다.**
 *
 * 시간대 계산을 손으로 하지 않고 Intl 에 맡기는 이유: 표준시 규칙은 우리 코드가
 * 아니라 시간대 데이터가 관리해야 한다. `+9시간` 을 직접 더하면 규칙이 바뀔 때
 * 아무도 여기를 고칠 생각을 못 한다.
 */
const KST = 'Asia/Seoul'

function seoulParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(d)) {
    if (part.type !== 'literal') p[part.type] = part.value
  }

  // 일부 런타임이 자정을 '24' 로 돌려준다. 날짜는 이미 맞으므로 시각만 고친다.
  if (p.hour === '24') p.hour = '00'

  return p as {
    year: string
    month: string
    day: string
    hour: string
    minute: string
    second: string
  }
}

/**
 * 시트에 넣을 신청 일시 — `2026-09-06 01:52:57` (한국 시각).
 *
 * `2026. 9. 5. 오후 4:52:57` 같은 표기를 쓰지 않는다. 스프레드시트에서
 * **글자 정렬이 곧 시간 정렬**이 되어야 담당자가 마감 순서를 눈으로 확인할 수 있다.
 */
function seoulStamp(d: Date | undefined): string {
  if (!d) return ''
  const p = seoulParts(d)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

function clients() {
  const cfg = getGoogleConfig()
  if (!cfg) return null

  const auth = new google.auth.JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: SCOPES,
  })

  return {
    cfg,
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  }
}

/** 첫 줄이 비어 있으면 머리글을 넣는다 */
async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A1:Q1',
  })
  if (res.data.values?.[0]?.length) return

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  })
}

/**
 * 드라이브에 올릴 파일 이름.
 *
 *   프로그램명_이름_2609052229.pdf
 *                  └── YYMMDDHHmm (24시간 표기)
 *
 * 담당자가 폴더를 열었을 때 바로 읽히도록 사람 기준으로 짓는다.
 * 신청번호는 **파일명에 넣지 않는다** — 대신 아래 appProperties 에 숨겨둔다.
 */
function pdfFileName(app: Application): string {
  const clean = (v: string) =>
    (v || '')
      .replace(/[\\/:*?"<>|]/g, '') // 드라이브·윈도우에서 문제되는 문자
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40)

  // YYMMDDHHmm — 연도 뒤 두 자리 + 월일 + 24시간 표기 시각. **한국 시각 기준.**
  // 붙여 쓰면 파일 이름이 짧고, 이름순 정렬이 곧 시간순 정렬이 된다.
  const d = app.submittedAt?.toDate?.() ?? new Date()
  const t = seoulParts(d)
  const stamp = `${t.year.slice(2)}${t.month}${t.day}${t.hour}${t.minute}`

  const program = clean(app.programTitle || app.programId) || '프로그램'
  const name = clean(app.applicant?.name || '') || '이름없음'

  return `${program}_${name}_${stamp}.pdf`
}

/**
 * 신청서 PDF 를 공유 드라이브에 올린다 (D-30).
 *
 * ⚠️ 반드시 **공유 드라이브** 여야 한다. 서비스 계정은 저장 용량이 없어서
 *    개인 드라이브에는 못 올린다. supportsAllDrives 도 빠뜨리면 안 된다.
 *
 * 중복 방지는 **파일명이 아니라 appProperties 의 신청번호**로 판단한다.
 * 파일명은 사람이 읽기 좋게 짓기 때문에 동명이인 등으로 겹칠 수 있고,
 * 그걸 식별자로 쓰면 남의 신청서를 자기 것으로 착각한다.
 * appProperties 는 이 앱만 읽는 숨은 값이라 화면에는 보이지 않는다.
 */
async function uploadPdf(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  app: Application,
  pdf: Buffer
): Promise<string> {
  const found = await drive.files.list({
    q:
      `appProperties has { key='applicationId' and value='${app.id}' } ` +
      `and '${folderId}' in parents and trashed = false`,
    fields: 'files(id, webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const already = found.data.files?.[0]
  if (already) {
    return (
      already.webViewLink ||
      `https://drive.google.com/file/d/${already.id}/view`
    )
  }

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: pdfFileName(app),
      parents: [folderId],
      mimeType: 'application/pdf',
      // 화면에는 안 보이는 표시. 재시도 시 같은 신청건을 알아보는 근거다.
      appProperties: { applicationId: app.id },
    },
    media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
    fields: 'id, webViewLink',
  })

  return res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`
}

/**
 * 어느 단계에서 실패했는지 오류 문구에 남긴다.
 *
 * 구글은 시트든 드라이브든 똑같이 "Requested entity was not found" 를 돌려준다.
 * 단계 표시가 없으면 SHEET_ID 를 봐야 할지 DRIVE_FOLDER_ID 를 봐야 할지
 * 알 수 없어서, 담당자가 설정 다섯 개를 전부 뒤지게 된다.
 */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`[${label}] ${msg}`)
  }
}

export interface SyncResult {
  skipped?: true
  sheetRow?: number
  driveUrl?: string
}

/**
 * 신청 1건을 시트·드라이브에 반영한다.
 *
 * 설정이 없으면 조용히 건너뛴다(오류 아님) — 연동 전에도 사이트는 돌아야 한다.
 */
export async function syncApplication(
  app: Application,
  pdf: Buffer | null
): Promise<SyncResult> {
  const c = clients()
  if (!c) return { skipped: true }

  const { cfg, sheets, drive } = c
  const ap = app.applicant

  let driveUrl = ''
  if (pdf) {
    driveUrl = await step('드라이브 업로드 · DRIVE_FOLDER_ID 확인', () =>
      uploadPdf(drive, cfg.driveFolderId, app, pdf)
    )
  }

  await step('시트 열기 · SHEET_ID 확인', () => ensureHeaders(sheets, cfg.sheetId))

  const row = [
    app.id,
    app.programTitle || app.programId,
    seoulStamp(app.submittedAt?.toDate?.()),
    MEMBER_TYPE_LABEL[memberTypeOf(ap?.memberType)],
    ap?.name || '',
    ap?.affiliation || '',
    ap?.major || '',
    // 학생이면 '20260000 · 3학년', 교원·일반이면 직위
    ap ? identityLine(ap) : '',
    ap?.phone || '',
    ap?.email || '',
    ap?.personalInfoConsent ? 'O' : 'X',
    ap?.portraitConsent ? 'O' : 'X',
    app.status,
    driveUrl,
    app.note ? `[${app.noteLabel || '추가 기재'}] ${app.note}` : '',
    // 저장된 라벨을 그대로 쓴다. 서버는 어떤 양식인지 모른다 (D-50).
    (app.formData ?? [])
      .filter((r) => r.value)
      .map((r) => `${r.label}: ${r.value}`)
      .join('\n'),
  ]

  const appended = await step('시트에 줄 추가', () =>
    sheets.spreadsheets.values.append({
      spreadsheetId: cfg.sheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    })
  )

  // '신청현황!A5:N5' 같은 문자열에서 행 번호만 뽑는다
  const updated = appended.data.updates?.updatedRange || ''
  const rowNo = Number(updated.match(/![A-Z]+(\d+)/)?.[1]) || undefined

  return { sheetRow: rowNo, driveUrl: driveUrl || undefined }
}

/* ═══════════════════════════════════════════════════════════════
   정산 — 영수증 → 드라이브 `02_정산`, 시트 「정산」 탭 한 줄 (09-12 · D-65)

   ⚠️ **계좌(bankInfo)는 여기서 절대 읽지 않는다** (D-38). 아래 열 목록에
      은행·계좌번호·예금주가 없는 것은 실수가 아니라 결정이다.
      열을 늘리기 전에 docs/4-기록/02-시트-드라이브-반출-범위.md 를 먼저 고칠 것.

   신청서 연동과 다른 점 둘:
   ① **다시 돌려도 안전하다.** 정산은 반려 → 수정 → 재제출이 있고, 승인·지급
      완료로 상태가 바뀐다. 그래서 "한 번 올렸으면 건너뜀"이 아니라, 파일은
      appProperties(경로 해시) 로 알아보고 건너뛰고, 시트 줄은 **있으면 그 줄을 고친다.**
   ② 파일이 여러 장이라 **사람마다 폴더**를 만든다:
        02_정산 / 프로그램명 / 이름 / 01_영수증.jpg …
      동명이인이 같은 프로그램에 있을 수 있으므로 사람 폴더는 이름이 아니라
      appProperties 의 정산번호로 찾고, 이름이 겹치면 `이름 (2)` 로 짓는다.
   ═══════════════════════════════════════════════════════════════ */

const SETTLEMENT_SHEET = '정산'

/** 「정산」 탭 머리글 — 반출 범위 문서 §1′ 과 일치해야 한다 */
const SETTLEMENT_HEADERS = [
  '정산번호',
  '프로그램명',
  '이름',
  '제출 일시',
  '영수증 건수',
  '드라이브 폴더',
  '상태(사본)',
  '지급일',
]

/** 드라이브 검색문(q)에 넣을 문자열 — 작은따옴표·역슬래시를 이스케이프 */
function q(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** 드라이브·윈도우에서 문제되는 문자 제거 */
function cleanName(v: string, max = 40): string {
  return (
    (v || '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max) || '이름없음'
  )
}

type Drive = ReturnType<typeof google.drive>

/** 이름으로 하위 폴더를 찾고 없으면 만든다 (프로그램 폴더용) */
async function folderByName(drive: Drive, parentId: string, name: string): Promise<string> {
  const found = await drive.files.list({
    q:
      `name = '${q(name)}' and '${parentId}' in parents ` +
      `and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const hit = found.data.files?.[0]?.id
  if (hit) return hit

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name, parents: [parentId], mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  })
  return res.data.id!
}

/**
 * 사람(정산 1건) 폴더 — **정산번호로** 찾는다. 동명이인 대비.
 * 없으면 이름으로 만들되, 같은 이름 폴더가 이미 있으면 `이름 (2)`.
 */
async function settlementFolder(
  drive: Drive,
  programFolderId: string,
  st: Settlement
): Promise<{ id: string; url: string }> {
  const byId = await drive.files.list({
    q:
      `appProperties has { key='settlementId' and value='${q(st.id)}' } ` +
      `and '${programFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const hit = byId.data.files?.[0]
  if (hit?.id) return { id: hit.id, url: hit.webViewLink || `https://drive.google.com/drive/folders/${hit.id}` }

  const base = cleanName(st.applicantName || '')
  const siblings = await drive.files.list({
    q:
      `'${programFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' ` +
      `and name contains '${q(base)}' and trashed = false`,
    fields: 'files(name)',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const taken = new Set((siblings.data.files ?? []).map((f) => f.name || ''))
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base} (${n})`

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      parents: [programFolderId],
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { settlementId: st.id },
    },
    fields: 'id, webViewLink',
  })
  return { id: res.data.id!, url: res.data.webViewLink || `https://drive.google.com/drive/folders/${res.data.id}` }
}

export interface ReceiptBlob {
  /** Storage 경로 — 드라이브에서 같은 파일을 알아보는 열쇠 */
  storagePath: string
  fileName: string
  contentType: string
  data: Buffer
}

/**
 * 파일을 알아보는 열쇠 — Storage 경로의 **해시**(40자).
 *
 * 경로를 그대로 넣었다가 실패했다(09-12): 구글은 appProperties 를 **키+값 합쳐
 * 124바이트**로 제한하는데, `support/settlements/{uid}/{정산번호}/{시각}_{한글파일명}`
 * 은 한글 한 글자가 3바이트라 쉽게 넘는다. 첫 장은 통과하고 둘째 장에서 걸려
 * "반은 올라간" 상태가 됐다. 해시는 길이가 고정이라 이 문제가 없다.
 */
function receiptKey(storagePath: string): string {
  return createHash('sha1').update(storagePath).digest('hex')
}

/** 영수증 한 장 — 이미 올라가 있으면 건너뛴다 (경로 해시로 판단) */
async function uploadReceipt(
  drive: Drive,
  folderId: string,
  index: number,
  r: ReceiptBlob
): Promise<'uploaded' | 'exists'> {
  const key = receiptKey(r.storagePath)
  const found = await drive.files.list({
    q:
      `(appProperties has { key='rk' and value='${key}' } ` +
      // 09-12 오전에 올라간 파일은 옛 방식(경로 그대로)이라 그것도 알아본다
      `or appProperties has { key='storagePath' and value='${q(r.storagePath)}' }) ` +
      `and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (found.data.files?.[0]) return 'exists'

  await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      // 01_영수증.jpg — 제출 순서대로 번호를 붙여 폴더에서 순서가 보이게
      name: `${String(index + 1).padStart(2, '0')}_${cleanName(r.fileName, 80)}`,
      parents: [folderId],
      mimeType: r.contentType,
      appProperties: { rk: key },
    },
    media: { mimeType: r.contentType, body: Readable.from(r.data) },
    fields: 'id',
  })
  return 'uploaded'
}

/** 사람 폴더 안에서 현재 목록에 없는 영수증(이 앱이 올린 것만)을 휴지통으로 */
async function trashStaleReceipts(drive: Drive, folderId: string, current: ReceiptBlob[]) {
  const keys = new Set(current.map((r) => receiptKey(r.storagePath)))
  const paths = new Set(current.map((r) => r.storagePath))
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id, appProperties)',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  for (const f of res.data.files ?? []) {
    const ap = f.appProperties ?? {}
    // 이 앱이 올린 표시(rk 또는 옛 storagePath)가 없는 파일은 사람이 넣은 것 — 건드리지 않는다
    if (!ap.rk && !ap.storagePath) continue
    if ((ap.rk && keys.has(ap.rk)) || (ap.storagePath && paths.has(ap.storagePath))) continue
    await drive.files.update({
      fileId: f.id!,
      supportsAllDrives: true,
      requestBody: { trashed: true },
    })
  }
}

/** 「정산」 탭이 없으면 만들고, 머리글이 비어 있으면 넣는다 */
async function ensureSettlementSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties.title',
  })
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === SETTLEMENT_SHEET)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SETTLEMENT_SHEET } } }] },
    })
  }

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${SETTLEMENT_SHEET}'!A1:H1`,
  })
  if (head.data.values?.[0]?.length) return

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${SETTLEMENT_SHEET}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [SETTLEMENT_HEADERS] },
  })
}

/** 지급일 — `2026-09-12` (한국 날짜). 시각은 의미 없어 뺀다 */
function seoulDate(d: Date | undefined): string {
  if (!d) return ''
  const p = seoulParts(d)
  return `${p.year}-${p.month}-${p.day}`
}

export interface SettlementSyncResult {
  skipped?: true
  sheetRow?: number
  driveUrl?: string
  uploaded: number
}

/**
 * 정산 1건을 드라이브·시트에 반영한다. **몇 번 돌려도 결과가 같다.**
 *
 * `DRIVE_SETTLEMENT_FOLDER_ID` 가 없으면 오류로 알린다 — 조용히 건너뛰면
 * 담당자는 "영수증이 왜 드라이브에 없지?"를 알 길이 없다. (연동 자체가
 * 설정되지 않은 경우만 신청서와 같이 건너뛴다.)
 */
export async function syncSettlement(
  st: Settlement,
  receipts: ReceiptBlob[]
): Promise<SettlementSyncResult> {
  const c = clients()
  if (!c) return { skipped: true, uploaded: 0 }
  const { cfg, sheets, drive } = c

  if (!cfg.settlementFolderId) {
    throw new Error(
      '[설정 없음] 영수증 폴더 DRIVE_SETTLEMENT_FOLDER_ID 가 없습니다. ' +
        '공유 드라이브 02_정산 폴더 ID 를 Vercel 환경변수에 넣어 주세요.'
    )
  }

  // ── 드라이브: 02_정산 / 프로그램 / 사람 / 파일 ─────────────────
  const program = cleanName(st.programTitle || st.programId)
  const programFolder = await step('드라이브 폴더 · DRIVE_SETTLEMENT_FOLDER_ID 확인', () =>
    folderByName(drive, cfg.settlementFolderId!, program)
  )
  const person = await step('드라이브 사람 폴더', () =>
    settlementFolder(drive, programFolder, st)
  )
  let uploaded = 0
  for (let i = 0; i < receipts.length; i++) {
    const r = await step(`영수증 업로드 ${i + 1}/${receipts.length}`, () =>
      uploadReceipt(drive, person.id, i, receipts[i])
    )
    if (r === 'uploaded') uploaded++
  }
  // 재제출 때 신청자가 뺀 영수증 — 드라이브 사본을 휴지통으로 (09-12).
  // 원본 목록에 없는 파일이 드라이브에만 남으면 담당자가 낸 적 없는 영수증을 본다.
  await step('뺀 영수증 정리', () => trashStaleReceipts(drive, person.id, receipts))

  // ── 시트: 「정산」 탭 ────────────────────────────────────────
  await step('시트 「정산」 탭 · SHEET_ID 확인', () =>
    ensureSettlementSheet(sheets, cfg.sheetId)
  )

  const row = [
    st.id,
    st.programTitle || st.programId,
    st.applicantName || '',
    seoulStamp(st.submittedAt?.toDate?.()),
    String(st.receipts?.length ?? 0),
    person.url,
    SETTLEMENT_STATUS_LABEL[st.status] ?? st.status,
    seoulDate(st.paidAt?.toDate?.()),
  ]

  // 이미 줄이 있으면 **그 줄을 고친다** — 재제출·승인·지급 완료가 같은 줄에 반영되게
  const existing = Number(st.sheetRowId) || 0
  if (existing > 1) {
    await step('시트 줄 갱신', () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: cfg.sheetId,
        range: `'${SETTLEMENT_SHEET}'!A${existing}:H${existing}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
    )
    return { sheetRow: existing, driveUrl: person.url, uploaded }
  }

  const appended = await step('시트에 줄 추가', () =>
    sheets.spreadsheets.values.append({
      spreadsheetId: cfg.sheetId,
      range: `'${SETTLEMENT_SHEET}'!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    })
  )
  const updated = appended.data.updates?.updatedRange || ''
  const rowNo = Number(updated.match(/![A-Z]+(\d+)/)?.[1]) || undefined

  return { sheetRow: rowNo, driveUrl: person.url, uploaded }
}
