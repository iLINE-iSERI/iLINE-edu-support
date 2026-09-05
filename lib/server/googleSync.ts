/**
 * 구글 시트·드라이브 동기화 (D-7 / D-9 / D-30) — 서버 전용.
 *
 * 반출 범위는 docs/05-sheet-drive-scope.md 에서 확정한 것만 다룬다.
 * **여기에 열을 추가하기 전에 그 문서를 먼저 고칠 것.**
 * 신분증·통장 사본 등 민감 서류는 이 경로로 절대 나가지 않는다.
 *
 * 원본은 언제나 Firebase 다. 시트와 드라이브는 담당자 편의를 위한 사본이고,
 * 그래서 이 모듈이 실패해도 신청 자체는 이미 완료된 상태여야 한다.
 */

import 'server-only'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { getGoogleConfig } from './env'
import type { Application } from '@/lib/types'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
]

/** 시트 머리글 — docs/05-sheet-drive-scope.md §1 과 일치해야 한다 */
const HEADERS = [
  '신청번호',
  '프로그램명',
  '신청 일시',
  '이름',
  '학번',
  '전공',
  '학년',
  '연락처',
  '이메일',
  '개인정보 수집·이용 동의',
  '초상권 활용 동의',
  '상태(사본)',
  '신청서 PDF',
  '추가 기재',
]

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
    range: 'A1:N1',
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

  // YYMMDDHHmm — 연도 뒤 두 자리 + 월일 + 24시간 표기 시각.
  // 붙여 쓰면 파일 이름이 짧고, 이름순 정렬이 곧 시간순 정렬이 된다.
  const d = app.submittedAt?.toDate?.() ?? new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${p(d.getFullYear() % 100)}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}`

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
    app.submittedAt?.toDate?.().toLocaleString('ko-KR') || '',
    ap?.name || '',
    ap?.studentId || '',
    ap?.major || '',
    ap?.grade || '',
    ap?.phone || '',
    ap?.email || '',
    ap?.personalInfoConsent ? 'O' : 'X',
    ap?.portraitConsent ? 'O' : 'X',
    app.status,
    driveUrl,
    app.note ? `[${app.noteLabel || '추가 기재'}] ${app.note}` : '',
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
