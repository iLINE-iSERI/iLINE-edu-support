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
 * 신청서 PDF 를 공유 드라이브에 올린다 (D-30).
 *
 * ⚠️ 반드시 **공유 드라이브** 여야 한다. 서비스 계정은 저장 용량이 없어서
 *    개인 드라이브에는 못 올린다. supportsAllDrives 도 빠뜨리면 안 된다.
 */
async function uploadPdf(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  name: string,
  pdf: Buffer
): Promise<string> {
  // ⚠️ Readable 은 파일 맨 위에서 정적으로 import 한다.
  //    await import('node:stream') 로 가져오면 번들러에 따라 네임스페이스가
  //    한 겹 더 씌워져 Readable 이 undefined 가 된다.
  //    (09-05: "Cannot read properties of undefined (reading 'from')")
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name, parents: [folderId], mimeType: 'application/pdf' },
    media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
    fields: 'id, webViewLink',
  })

  return res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`
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
    const safeName = `${app.id}_${ap?.name || '이름없음'}.pdf`.replace(/[/\\]/g, '_')
    driveUrl = await uploadPdf(drive, cfg.driveFolderId, safeName, pdf)
  }

  await ensureHeaders(sheets, cfg.sheetId)

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

  const appended = await sheets.spreadsheets.values.append({
    spreadsheetId: cfg.sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })

  // '신청현황!A5:N5' 같은 문자열에서 행 번호만 뽑는다
  const updated = appended.data.updates?.updatedRange || ''
  const rowNo = Number(updated.match(/![A-Z]+(\d+)/)?.[1]) || undefined

  return { sheetRow: rowNo, driveUrl: driveUrl || undefined }
}
