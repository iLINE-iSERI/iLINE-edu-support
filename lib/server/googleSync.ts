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
  APPLICATION_STATUS_LABEL,
  MEMBER_TYPE_LABEL,
  SETTLEMENT_STATUS_LABEL,
  DEFAULT_SETTLEMENT_DOC,
  settlementRoundOf,
  settlementDocSummary,
  OUTPUT_STATUS_LABEL,
  INQUIRY_STATUS_LABEL,
  memberTypeOf,
  identityLine,
  GRADE_LABEL,
  type Application,
  type Settlement,
  type Output,
  type Inquiry,
  type SupportUser,
} from '@/lib/types'
import { MEMBER_SHEET_ENABLED } from '@/lib/config/memberSheet'

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
  '추가 기재',
  // D-50: 프로그램 전용 항목. **항목마다 열을 만들지 않는다** —
  // 프로그램이 셋만 되어도 시트가 빈칸투성이가 된다(D-43에서 겪은 일).
  // 한 칸에 `항목: 값` 을 줄바꿈으로 이어 붙인다.
  '프로그램별 기재',
  // D-73: 마감 전 본인 수정 — '2회 · 2026-09-20 14:02' 처럼. 없으면 빈칸
  '수정',
  // 09-16 iSERI: 링크 열은 맨 끝으로 (기재 내용을 먼저 읽게)
  '신청서 PDF',
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


/* ═══════════════════════════════════════════════════════════════
   시트 서식 (D-74 · 09-16)

   iSERI: "팀 프로그램의 기재가 들어오면 가독성이 나쁘다 — 행 높이·열 너비가 내용에
   맞게, 모든 셀 가운데 정렬." 담당자가 시트에서 손으로 해 둘 수도 있지만, 「정산」 탭은
   코드가 만들고 시트가 새로 생길 수도 있어 코드가 맡는다.

   · 열 너비는 **줄을 쓸 때마다** 내용에 맞춘다 (iSERI 09-16: "보기 불편할 때마다 손으로
     고칠 수는 없다"). 담당자가 손으로 넓힌 너비는 다음 동기화 때 되돌아간다 — 의도된 것.
     긴 글이 오는 열(추가 기재·프로그램별 기재)만 고정 폭 + 줄바꿈 (자동 맞춤은 가장 긴
     줄에 맞추므로 자유 글이면 한없이 넓어진다).
   · 줄을 쓸 때마다 **그 줄만** 서식을 건다: 가로·세로 가운데, 취소된 건은 회색 바탕.
   · ⚠️ 줄바꿈(WRAP)은 **긴 글 열에만** 건다 (09-17 iSERI 발견). 구글의 자동 맞춤은
     "줄바꿈을 허용한 상태의 최소 폭"을 재는데, 한글은 글자마다 끊을 수 있어 짧은 한글
     열이 **글자 한 개 폭**으로 줄어든다("김종선"이 세 줄). 짧은 열은 CLIP + 자동 맞춤.
   · 열 너비는 줄을 쓴 **뒤에**, 열의 값을 전부 읽어 **직접 잰다** (API 자동 맞춤은 한글을
     좁게 잰다 — 09-17). 바탕색은 취소 줄만 칠하고 나머지는 담당자 몫으로 남긴다.
   · 줄 추가는 OVERWRITE (D-92 · 09-18): INSERT_ROWS 는 끼워 넣기라 **윗줄 서식을 물려받는다**
     — 첫 줄은 헤더(노란 바탕·굵게)를 그대로 물려받았다. OVERWRITE 는 아래 빈 칸에 써 넣어
     기본 서식으로 들어간다. 09-17 에 "담당자가 칠한 노란색" 이라 본 것도 사실은 이것.
     → **D-127 (10-07) 에서 append 자체를 버렸다** — 필터가 켜져 있으면 숨은 줄을 덮어썼다.
       지금은 빈 줄을 끼워 넣되 **아래 줄**의 서식을 물려받는다(`insertRowAfterLast`).
   ═══════════════════════════════════════════════════════════════ */

type Sheets = ReturnType<typeof google.sheets>

/**
 * 탭 이름 → 숫자 ID (batchUpdate 는 이름이 아니라 gid 를 요구한다). 이름이 없으면 첫 탭.
 * `setUp`(첫 줄 고정 여부)은 참고용 — 09-16부터 열 너비는 매번 맞추므로 표시로 쓰지 않는다.
 */
async function sheetInfo(
  sheets: Sheets,
  spreadsheetId: string,
  title?: string
): Promise<{ gid: number; setUp: boolean; exists: boolean }> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title,gridProperties.frozenRowCount)',
  })
  const list = meta.data.sheets ?? []
  const hit = title ? list.find((s) => s.properties?.title === title) : list[0]
  return {
    gid: hit?.properties?.sheetId ?? 0,
    setUp: (hit?.properties?.gridProperties?.frozenRowCount ?? 0) >= 1,
    exists: Boolean(hit),
  }
}

/** 열 번호(0부터) → 픽셀 너비. 여기 있는 열만 줄바꿈 + 고정 폭, 나머지는 자동 맞춤 */
type ColumnWidths = Record<number, number>

/** 머리글 서식 — 첫 줄 고정·굵게·가운데. 바탕색은 담당자 몫이라 건드리지 않는다 */
async function setupHeader(sheets: Sheets, spreadsheetId: string, gid: number, columnCount: number) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: gid, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                wrapStrategy: 'CLIP',
              },
            },
            fields: 'userEnteredFormat(textFormat.bold,horizontalAlignment,verticalAlignment,wrapStrategy)',
          },
        },
      ],
    },
  })
}

/**
 * 글자 폭 어림 (픽셀, 기본 글꼴 10pt 기준).
 * 한글·한자 등 전각은 14px, 영문·숫자·기호는 7.5px. 정확할 필요는 없다 —
 * "잘리지 않고 너무 넓지 않게"가 목표.
 */
function textWidthPx(text: string): number {
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0
    w += c > 0x2e80 ? 14 : c === 0x20 ? 4 : 7.5
  }
  return w
}

/**
 * 열 너비 — **줄을 쓰고 서식을 건 뒤에** 부른다.
 *
 * ⚠️ API 의 autoResizeDimensions 는 쓰지 않는다 (09-17). 서버가 영문 기준으로 어림잡아
 *    한글 열을 좁게 잰다 — 머리글 "회원 유형"조차 잘렸다. 대신 **열의 값을 전부 읽어
 *    직접 잰다**: 가장 긴 값(줄바꿈이 있으면 가장 긴 줄) + 여백 24px, 최소 64 · 최대 360.
 *    긴 글 열(고정 폭)은 재지 않는다.
 */
async function fitColumns(
  sheets: Sheets,
  spreadsheetId: string,
  gid: number,
  tab: string | null, // null = 첫 탭
  columnCount: number,
  fixed: ColumnWidths
) {
  const lastCol = String.fromCharCode(64 + columnCount) // 17 → 'Q'
  const range = tab ? `'${tab}'!A1:${lastCol}` : `A1:${lastCol}`
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  const rows = (res.data.values ?? []) as string[][]

  const requests: object[] = []
  for (let i = 0; i < columnCount; i++) {
    let px: number
    if (fixed[i] !== undefined) {
      px = fixed[i]
    } else {
      let max = 0
      rows.forEach((r, rowIdx) => {
        const cell = String(r[i] ?? '')
        for (const line of cell.split('\n')) {
          // 머리글은 굵게라 조금 더 넓다
          const w = textWidthPx(line) * (rowIdx === 0 ? 1.1 : 1)
          if (w > max) max = w
        }
      })
      px = Math.min(360, Math.max(64, Math.round(max + 24)))
    }
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: gid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: 'pixelSize',
      },
    })
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

/**
 * 이 건이 쓸 줄 — **A열에서 자기 번호를 찾는다** (D-109 · 09-25). 없으면 0(새로 붙인다).
 *
 * 🔴 **왜 기억해 둔 번호(`sheetRowId`)를 그대로 믿지 않나.** 예전에는 그 번호의 줄을
 *    **확인 없이 덮어썼다.** 담당자가 시트에서 **행을 삭제**하면 아래 줄이 위로 당겨져
 *    번호가 어긋나고, 줄 **내용을 비우면** 새 신청이 그 빈 줄로 들어와 두 문서가 같은
 *    번호를 기억하게 된다. 그 뒤 동기화 때마다 **다른 사람의 줄을 덮어썼다**(09-25 iSERI
 *    가 시험 줄을 지운 뒤 실제로 겪음). A열은 네 탭 모두 **그 문서의 번호**라, 쓸 때마다
 *    거기서 찾으면 줄을 지우든 비우든 정렬하든 **각 건이 자기 줄을 스스로 찾는다.**
 *
 * 기억해 둔 번호는 **먼저 확인하는 힌트**로만 쓴다 — 그 줄 A열이 자기 번호면 바로 쓰고,
 * 아니면 A열 전체에서 찾는다. 같은 번호가 여러 줄이면 첫 줄에 쓴다(나머지는
 * `scripts/check-sheet-rows.mjs` 가 「중복」으로 알려 준다 — 여기서 지우지 않는다).
 *
 * 없으면(새 줄) `insertRowAfterLast` 로 끼워 넣는다(D-127). ⚠️ 예전에는 「`append` 는 구글이 한 줄씩
 * 차례로 붙여 준다」고 믿고 append 를 썼는데 틀렸다 — 필터가 켜져 있으면 숨은 줄을 덮어쓰고, 거의
 * 동시에 온 두 건이 같은 줄에 써졌다(10-03·10-05 해커톤 7건 · insertRowAfterLast 주석).
 *
 * `tab` 이 null 이면 **첫 번째 탭**(신청) — 이름이 아니라 위치로 찾는다.
 */
async function findSheetRow(
  sheets: Sheets,
  spreadsheetId: string,
  tab: string | null,
  id: string,
  hint: number
): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tab ? `'${tab}'!A:A` : 'A:A',
    majorDimension: 'COLUMNS',
  })
  // 인덱스 0 이 1행(머리글)
  const colA = (res.data.values?.[0] ?? []).map((v) => String(v ?? '').trim())
  if (hint > 1 && colA[hint - 1] === id) return hint
  const idx = colA.findIndex((v, i) => i > 0 && v === id)
  return idx > 0 ? idx + 1 : 0
}

/**
 * 링크 셀 — URL 을 그대로 쓰면 80자가 넘어 열이 잘린다 (09-17). 셀에는 짧은 글자만 두고
 * 그 글자에 링크를 건다. 클릭하면 똑같이 열리고, 열은 글자 폭만 차지한다.
 * 값을 RAW 로 쓴 **뒤에** 부른다 (그 셀만 덮어쓴다).
 */
async function linkCell(
  sheets: Sheets,
  spreadsheetId: string,
  gid: number,
  rowNo: number,
  colIndex: number,
  url: string,
  label: string
) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [linkCellRequest(gid, rowNo, colIndex, url, label)] },
  })
}

/** linkCell 의 요청 하나 — 새 줄을 넣는 batchUpdate 에 함께 싣는다(D-127) */
function linkCellRequest(gid: number, rowNo: number, colIndex: number, url: string, label: string): object {
  return {
    updateCells: {
      range: { sheetId: gid, startRowIndex: rowNo - 1, endRowIndex: rowNo, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
      rows: [
        {
          values: [
            {
              userEnteredValue: { stringValue: label },
              userEnteredFormat: { textFormat: { link: { uri: url }, underline: true } },
            },
          ],
        },
      ],
      fields: 'userEnteredValue,userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.underline',
    },
  }
}

/**
 * 새 줄 넣기 (D-127 · 10-07) — **A열 마지막 값 바로 아래에 빈 줄을 하나 끼워 넣고, 그 줄을 채운다.**
 * 끼워 넣기 · 값 · (부르는 쪽이 준) 서식·링크를 **한 번의 batchUpdate** 로 보낸다. 구글은 요청 하나를
 * 통째로 처리하므로 두 건이 동시에 와도 각자 자기 빈 줄을 끼워 넣고 채운다 — **무엇도 덮어쓰지 않는다.**
 * 서식·링크까지 같은 요청에 싣는 이유: 따로 보내면 그 사이 다른 건이 위에 끼어들어 줄 번호가 밀리고,
 * 남의 줄에 링크가 걸린다.
 *
 * 🔴 **왜 append 를 버렸나.** 09-18 부터 `values.append`(OVERWRITE)로 새 줄을 붙였는데, append 는
 *    「표의 끝」을 **구글이 짐작**한다. 시트에 필터가 켜져 있으면 **보이는 마지막 줄**을 끝으로 보고 그
 *    아래 **숨은 줄에 덮어쓴다** — 새로 쓴 줄도 숨은 채라 다음 건이 또 같은 줄에 쓴다. 10-05 해커톤
 *    마감 전날, 신청 탭 필터(프로그램명·상태) 때문에 **46행 한 줄에 여섯 건이 차례로 덮어써져** 시트에서
 *    사라졌다(사이트·드라이브에는 그대로 · 10-07 운영 담당자 발견). 10-03 에는 0.8초 차이로 낸 두 건이
 *    같은 41행에 써졌다. 예전 주석의 「append 는 한 줄씩 차례로 붙여 준다」는 틀린 믿음이었다.
 *
 * 자리는 A열(모든 탭에서 그 문서의 번호)로 정한다 — 필터·숨김과 상관없이 값이 있는 마지막 줄 다음.
 * 두 건이 같은 자리를 계산해도 뒤에 온 쪽이 앞 줄을 한 칸 아래로 밀고 들어갈 뿐이다(순서만 바뀜 —
 * 「신청 일시」 열로 정렬하면 된다). 서식은 **아래 줄**(빈 줄)에서 물려받는다(`inheritFromBefore:
 * false`) — 윗줄이 머리글(노란 바탕·굵게)이나 회색 취소 줄이어도 옮겨 오지 않게(D-92 가 append 의
 * INSERT_ROWS 를 버린 까닭과 같다). 시트 맨 아래라 물려받을 줄이 없는 경우를 따로 묻지 않으려고
 * **맨 끝에 빈 줄 하나를 늘 먼저 덧붙인다** — 시트 크기를 읽는 요청이 하나 줄어든다(구글 시트 읽기 한도는
 * 1분에 60번이고 운영 사이트 전체가 같이 쓴다 — 10-07 시험에서 걸려 봄). 시트는 새 줄마다 빈 줄 하나씩 길어진다.
 *
 * 돌려주는 값: 넣은 줄 번호(1부터). 열 너비는 열 전체를 다루므로 부르는 쪽이 따로 맞춘다.
 */
async function insertRowAfterLast(
  sheets: Sheets,
  spreadsheetId: string,
  tab: string | null, // null = 첫 탭
  gid: number,
  values: (string | number)[],
  extra: (rowNo: number) => object[]
): Promise<number> {
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tab ? `'${tab}'!A:A` : 'A:A',
    majorDimension: 'COLUMNS',
  })
  // A열 값 개수 = 값이 있는 마지막 줄 번호(구글이 끝의 빈 칸은 잘라서 준다). 0부터 센 새 줄 자리와 같다
  const at = Math.max(1, colRes.data.values?.[0]?.length ?? 0)
  const rowNo = at + 1

  const requests: object[] = [
    // 끼워 넣을 자리 아래에 늘 줄이 있게(물려받을 서식 = 빈 줄) — 맨 끝에 하나
    { appendDimension: { sheetId: gid, dimension: 'ROWS', length: 1 } },
    {
      insertDimension: {
        range: { sheetId: gid, dimension: 'ROWS', startIndex: at, endIndex: at + 1 },
        inheritFromBefore: false,
      },
    },
    {
      updateCells: {
        start: { sheetId: gid, rowIndex: at, columnIndex: 0 },
        // RAW 로 쓰던 것과 같다 — 글자는 글자로(전화번호·날짜가 숫자·날짜로 바뀌지 않게), 빈 값은 빈 칸
        rows: [
          {
            values: values.map((v) =>
              typeof v === 'number'
                ? { userEnteredValue: { numberValue: v } }
                : v === ''
                  ? {}
                  : { userEnteredValue: { stringValue: v } }
            ),
          },
        ],
        fields: 'userEnteredValue',
      },
    },
    ...extra(rowNo),
  ]
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
  return rowNo
}

/**
 * 한 줄 서식 — 가운데 정렬 · 줄바꿈 · (취소면) 회색 바탕.
 * 행 높이는 따로 정하지 않는다: 줄바꿈이 켜져 있고 높이를 손으로 정하지 않았으면
 * 구글 시트가 내용에 맞춰 스스로 늘린다.
 */
async function formatRow(
  sheets: Sheets,
  spreadsheetId: string,
  gid: number,
  rowNo: number, // 1부터 (시트 표기)
  columnCount: number,
  wrapCols: ColumnWidths,
  muted: boolean
) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: rowFormatRequests(gid, rowNo, columnCount, wrapCols, muted) },
  })
}

/** formatRow 의 요청들 — 새 줄을 넣는 batchUpdate 에 함께 싣는다(D-127) */
function rowFormatRequests(
  gid: number,
  rowNo: number,
  columnCount: number,
  wrapCols: ColumnWidths,
  muted: boolean
): object[] {
  // 바탕색은 **취소 줄만** 회색으로 칠한다. 나머지 줄은 건드리지 않는다 — 흰색을 강제하면
  // 담당자가 손으로 칠한 색이 지워진다. (09-17 "노란색이 A~Q 만 흰색으로" 는 INSERT_ROWS 가
  // 헤더 서식을 물려준 것을 이 함수가 지우던 것 — D-92 에서 OVERWRITE 로 원인을 없앰)
  const base: Record<string, unknown> = {
    horizontalAlignment: 'CENTER',
    verticalAlignment: 'MIDDLE',
    wrapStrategy: 'CLIP', // 줄바꿈 없음 — 긴 글 열만 아래에서 WRAP
  }
  let fields = 'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy'
  if (muted) {
    base.backgroundColor = { red: 0.93, green: 0.93, blue: 0.93 }
    base.textFormat = { foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 } }
    fields += ',backgroundColor,textFormat.foregroundColor'
  }
  fields += ')'
  const requests: object[] = [
    {
      repeatCell: {
        range: { sheetId: gid, startRowIndex: rowNo - 1, endRowIndex: rowNo, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: { userEnteredFormat: base },
        fields,
      },
    },
  ]
  // 긴 글 열만 줄바꿈 — 행 높이는 이 열들 때문에 늘어난다
  for (const col of Object.keys(wrapCols)) {
    const i = Number(col)
    requests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: rowNo - 1, endRowIndex: rowNo, startColumnIndex: i, endColumnIndex: i + 1 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
        fields: 'userEnteredFormat.wrapStrategy',
      },
    })
  }
  return requests
}

/** 신청 탭에서 고정 폭으로 둘 열 — 긴 글이 오는 곳. 나머지는 자동 맞춤 */
/** Q 신청서 PDF — 셀에는 'PDF 열기' 글자 + 링크 (URL 은 잘려서) */
const PDF_COL = 16

const APP_FIXED_WIDTHS: ColumnWidths = {
  13: 320, // N 추가 기재 — 자유 글이라 자동 맞춤을 하면 한없이 넓어진다
  14: 440, // O 프로그램별 기재 — 같은 이유. 줄바꿈으로 감싼다 (넓을수록 줄 수가 준다)
}

/** 첫 줄이 비어 있으면 머리글을 넣는다. 첫 탭의 gid 를 돌려준다 */
async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
): Promise<number> {
  const { gid } = await sheetInfo(sheets, sheetId)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A1:R1',
  })
  const first = (res.data.values?.[0] ?? []).map(String)
  const same = first.length === HEADERS.length && HEADERS.every((h, i) => first[i] === h)
  if (!same) {
    // 비어 있거나(처음), 열이 늘거나 순서가 바뀌었으면 머리글을 다시 쓴다.
    // ⚠️ 값 행은 건드리지 않는다 — 순서가 바뀐 뒤의 옛 줄은 다음 동기화 때 그 줄이
    //    새 순서로 다시 써지거나, 시험 데이터라면 정리 스크립트로 지운다.
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    })
  }
  await setupHeader(sheets, sheetId, gid, HEADERS.length)
  return gid
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
  pdf: Buffer,
  /** 수정본(D-73)이면 같은 파일의 **내용을 교체**한다 — 링크·이름은 그대로 */
  replace = false
): Promise<string> {
  // 부모 폴더를 조건에 넣지 않는다 — 취소된 건은 「취소」 하위 폴더로 옮겨져 있다 (D-74)
  const found = await drive.files.list({
    q:
      `appProperties has { key='applicationId' and value='${app.id}' } ` +
      `and trashed = false`,
    fields: 'files(id, webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const already = found.data.files?.[0]
  if (already) {
    if (replace && already.id) {
      await drive.files.update({
        fileId: already.id,
        supportsAllDrives: true,
        media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
      })
    }
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
 * 취소된 건의 PDF 를 같은 폴더 안 「취소」 하위 폴더로 옮긴다 (D-74 · 09-16 iSERI).
 * 지우지 않는다 — 내역은 남아야 한다. 파일 ID 가 그대로라 시트의 링크도 살아 있다.
 * 이미 거기 있으면 아무것도 하지 않는다. 파일이 없으면(연동 전 건) 조용히 넘어간다.
 */
async function moveToCancelled(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  app: Application
): Promise<void> {
  const found = await drive.files.list({
    q:
      `appProperties has { key='applicationId' and value='${app.id}' } ` +
      `and trashed = false`,
    fields: 'files(id, parents)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const file = found.data.files?.[0]
  if (!file?.id) return
  const cancelledFolder = await folderByName(drive, folderId, '취소')
  if ((file.parents ?? []).includes(cancelledFolder)) return
  await drive.files.update({
    fileId: file.id,
    supportsAllDrives: true,
    addParents: cancelledFolder,
    removeParents: (file.parents ?? []).join(','),
  })
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
  /** `onlyIfMissing` 인데 시트에 이미 줄이 있어 아무것도 하지 않았다 */
  alreadyThere?: true
}

/**
 * 신청 1건을 시트·드라이브에 반영한다.
 *
 * 설정이 없으면 조용히 건너뛴다(오류 아님) — 연동 전에도 사이트는 돌아야 한다.
 *
 * `onlyIfMissing` (D-127) — **시트에 그 번호의 줄이 없을 때만** 새 줄을 넣는다. 이미 있으면 시트도
 * 드라이브도 **아무것도 쓰지 않는다**(담당자가 시트에서 손으로 고친 칸을 사이트 값으로 덮지 않게 —
 * 10-07 sunbell 「기존 값들을 지킬 수 있게」). 드라이브 PDF 도 이미 있으면 내용을 바꾸지 않고 링크만 쓴다.
 * 담당자 화면의 「시트에 없으면 다시 넣기」가 부른다 — append 가 덮어써 사라진 줄(10-05 해커톤 7건) 되살리기.
 */
export async function syncApplication(
  app: Application,
  pdf: Buffer | null,
  opts: { onlyIfMissing?: boolean } = {}
): Promise<SyncResult> {
  const c = clients()
  if (!c) return { skipped: true }

  const { cfg, sheets, drive } = c
  const ap = app.applicant

  if (opts.onlyIfMissing) {
    // 읽기만 — 머리글 손질(ensureHeaders)도 줄이 없을 때 아래에서 한다
    const there = await step('시트 줄 찾기', () =>
      findSheetRow(sheets, cfg.sheetId, null, app.id, Number(app.sheetRowId) || 0)
    )
    if (there > 1) return { sheetRow: there, alreadyThere: true }
  }

  const edited = (app.editCount ?? 0) > 0

  let driveUrl = ''
  if (pdf) {
    driveUrl = await step('드라이브 업로드 · DRIVE_FOLDER_ID 확인', () =>
      uploadPdf(drive, cfg.driveFolderId, app, pdf, edited && !opts.onlyIfMissing)
    )
  }

  // 취소된 건: PDF 를 「취소」 폴더로 (D-74). 업로드 뒤에 옮겨야 처음 동기화되는 취소 건도
  // 제자리에 간다. 시트 줄은 아래에서 회색으로.
  const cancelled = app.status === 'cancelled'
  if (cancelled) {
    await step('취소 폴더로 이동', () => moveToCancelled(drive, cfg.driveFolderId, app))
  }

  const gid = await step('시트 열기 · SHEET_ID 확인', () => ensureHeaders(sheets, cfg.sheetId))

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
    // D-74: 영어 코드 대신 화면과 같은 한글 상태. 상태가 바뀔 때마다 이 줄을 다시 쓴다
    // D-116: 선정 뒤 본인 취소는 담당자가 놓치면 안 돼서 상태 칸에 함께 적는다
    (APPLICATION_STATUS_LABEL[app.status] ?? app.status) +
      (app.cancelledFromStatus === 'approved' ? ' (선정 뒤 본인 취소)' : ''),
    app.note ? `[${app.noteLabel || '추가 기재'}] ${app.note}` : '',
    // 저장된 라벨을 그대로 쓴다. 서버는 어떤 양식인지 모른다 (D-50).
    (app.formData ?? [])
      .filter((r) => r.value)
      .map((r) => `${r.label}: ${r.value}`)
      .join('\n'),
    // D-73 수정 흔적 · D-116 선정한 뒤에 고쳤으면 그 사실도
    edited
      ? `${app.editCount}회 · ${seoulStamp(app.lastEditedAt?.toDate?.())}` +
        (app.status === 'approved' &&
        (app.lastEditedAt?.toMillis?.() ?? 0) > (app.reviewedAt?.toMillis?.() ?? Infinity)
          ? ' · 선정 뒤'
          : '')
      : '',
    driveUrl,
  ]

  // 이미 시트에 줄이 있으면(수정본 · 재시도) **그 줄을 덮어쓴다** — 정산 탭과 같은 방식.
  // 새 줄을 또 붙이면 담당자가 같은 사람을 두 번 세게 된다.
  // D-109: 기억한 번호를 믿지 않고 A열에서 자기 번호를 찾는다 (findSheetRow)
  const existing = await step('시트 줄 찾기', () =>
    findSheetRow(sheets, cfg.sheetId, null, app.id, Number(app.sheetRowId) || 0)
  )
  if (existing > 1) {
    await step('시트 줄 갱신', () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: cfg.sheetId,
        range: `A${existing}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
    )
    await step('시트 줄 서식', () =>
      formatRow(sheets, cfg.sheetId, gid, existing, HEADERS.length, APP_FIXED_WIDTHS, cancelled)
    )
    if (driveUrl) {
      await step('PDF 링크', () => linkCell(sheets, cfg.sheetId, gid, existing, PDF_COL, driveUrl, 'PDF 열기'))
    }
    // 열 너비는 줄을 쓴 뒤 매번 내용에 맞춘다 (09-16 iSERI)
    await step('열 너비 맞춤', () =>
      fitColumns(sheets, cfg.sheetId, gid, null, HEADERS.length, APP_FIXED_WIDTHS)
    )
    return { sheetRow: existing, driveUrl: driveUrl || undefined }
  }

  // 새 줄 — 끼워 넣기·값·서식·PDF 링크를 한 번에 (D-127 · append 는 필터가 켜져 있으면 덮어썼다)
  const rowNo = await step('시트에 줄 추가', () =>
    insertRowAfterLast(sheets, cfg.sheetId, null, gid, row, (r) => [
      ...rowFormatRequests(gid, r, HEADERS.length, APP_FIXED_WIDTHS, cancelled),
      ...(driveUrl ? [linkCellRequest(gid, r, PDF_COL, driveUrl, 'PDF 열기')] : []),
    ])
  )
  await step('열 너비 맞춤', () =>
    fitColumns(sheets, cfg.sheetId, gid, null, HEADERS.length, APP_FIXED_WIDTHS)
  )

  return { sheetRow: rowNo, driveUrl: driveUrl || undefined }
}

/* ═══════════════════════════════════════════════════════════════
   정산 — 증빙서류 → 드라이브 「정산」, 시트 「정산」 탭 한 줄 (09-12 · D-65 · D-117)

   ⚠️ **계좌는 여기서 읽지 않는다** (D-38) — 그리고 D-108(09-25)부터는 **아예
      받지 않는다.** 아래 열 목록에 은행·계좌번호·예금주가 없는 것은 실수가 아니다.
      열을 늘리기 전에 docs/4-기록/02-시트-드라이브-반출-범위.md 를 먼저 고칠 것.

   신청서 연동과 다른 점 둘:
   ① **다시 돌려도 안전하다.** 정산은 반려 → 수정 → 재제출이 있고, 확인 완료·지급
      완료로 상태가 바뀐다. 그래서 "한 번 올렸으면 건너뜀"이 아니라, 파일은
      appProperties(경로 해시) 로 알아보고 건너뛰고, 시트 줄은 **있으면 그 줄을 고친다.**
   ② 파일이 여러 장이라 폴더로 묶는다 (D-117 · 09-30 — 신청 1건에 정산 여러 번):
        정산 / 프로그램명 / 팀명(개인이면 이름) / 01차_이름_영수증_01_원래이름.jpg …
      · 폴더 이름(「정산」)은 무엇이든 된다 — 코드는 환경변수의 **ID로** 찾는다
      · 팀·사람 폴더는 이름이 아니라 appProperties 의 **묶음 열쇠(uk)** 로 찾는다 —
        동명이인·같은 이름의 팀·사람이 있어도 섞이지 않고, 이름이 겹치면 `이름 (2)`
      · 한 폴더에 여러 사람·여러 회차가 모이므로 파일 이름에 **회차·이름·종류**를 넣고,
        파일마다 정산번호(sid)를 붙여 **뺀 파일 정리는 그 정산의 파일끼리만** 비교한다
      · 회차는 **사람마다** 센다 — 같은 팀 폴더의 「01차」가 여럿일 수 있다(대표자 1차 ≠ 팀 1차)
   ═══════════════════════════════════════════════════════════════ */

const SETTLEMENT_SHEET = '정산'

/** 「정산」 탭 — 고정 폭 열 없음 (폴더 링크는 '폴더 열기' 글자 + 링크) */
const SETTLEMENT_FIXED_WIDTHS: ColumnWidths = {}
/** H 증빙서류 폴더 */
const FOLDER_COL = 7

/** 「정산」 탭 머리글 — 반출 범위 문서 §1′ 과 일치해야 한다 (D-117 에 10열로) */
const SETTLEMENT_HEADERS = [
  '정산번호',        // A — 1차는 신청번호, 2차부터 신청번호_2
  '프로그램명',      // B
  '팀명',            // C — 개인 프로그램이면 빈칸. 신청서에서 서버가 계산(teamNameOf)
  '이름',            // D
  '회차',            // E — 사람마다 1차·2차 …
  '제출 일시',       // F
  '증빙서류',        // G — 「영수증 3 · 회의록 1」
  '증빙서류 폴더',   // H — 팀(개인이면 사람) 폴더
  '상태',            // I — 제출 완료 / 확인 완료 / 지급 완료 / 반려 (사본 — 원본은 사이트)
  '지급일',          // J
]
const SETTLEMENT_LAST_COL = String.fromCharCode(64 + SETTLEMENT_HEADERS.length) // 'J'

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

/** 정산 묶음 — 팀 프로그램이면 팀, 아니면 사람 (D-117) */
export interface SettlementUnit {
  /** 팀명 — 없으면 개인 */
  team?: string
}

/**
 * 팀·사람 폴더 — **묶음 열쇠(uk)로** 찾는다 (D-117).
 *
 * 열쇠는 `team:{팀명}` 또는 `uid:{uid}` 의 해시다 — appProperties 는 키+값 124바이트
 * 제한이라 한글 팀명을 그대로 넣으면 넘칠 수 있다(receiptKey 와 같은 이유).
 * 없으면 팀명(개인이면 이름)으로 만들되, 같은 이름 폴더가 이미 있으면 `이름 (2)`.
 */
async function unitFolder(
  drive: Drive,
  programFolderId: string,
  st: Settlement,
  unit: SettlementUnit
): Promise<{ id: string; url: string }> {
  const uk = createHash('sha1')
    .update(unit.team ? `team:${unit.team}` : `uid:${st.uid}`)
    .digest('hex')
  const byKey = await drive.files.list({
    q:
      `appProperties has { key='uk' and value='${uk}' } ` +
      `and '${programFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const hit = byKey.data.files?.[0]
  if (hit?.id) return { id: hit.id, url: hit.webViewLink || `https://drive.google.com/drive/folders/${hit.id}` }

  const base = cleanName(unit.team || st.applicantName || '')
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
      appProperties: { uk },
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
  /** 증빙서류 종류 이름 (D-117) — 없으면 「증빙서류」 */
  docLabel?: string
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

/**
 * 드라이브 파일 이름 (D-117) — `01차_홍길동_영수증_01_원래이름.jpg`.
 * 한 폴더에 팀원 여럿·회차 여럿이 모이므로 회차·이름·종류를 앞에 둔다.
 * 원래 이름은 줄이더라도 **확장자는 남긴다**(잘리면 드라이브가 파일을 못 연다).
 */
function receiptDriveName(st: Settlement, label: string, n: number, original: string): string {
  const dot = original.lastIndexOf('.')
  const ext = dot > 0 && original.length - dot <= 6 ? original.slice(dot) : ''
  const stem = ext ? original.slice(0, dot) : original
  return [
    `${String(settlementRoundOf(st)).padStart(2, '0')}차`,
    cleanName(st.applicantName || '', 20),
    cleanName(label, 20),
    String(n).padStart(2, '0'),
    cleanName(stem, 60) + ext.replace(/[\\/:*?"<>|]/g, ''),
  ].join('_')
}

/** 증빙서류 한 장 — 이미 올라가 있으면 건너뛴다 (경로 해시로 판단) */
async function uploadReceipt(
  drive: Drive,
  folderId: string,
  st: Settlement,
  n: number,
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
      name: receiptDriveName(st, r.docLabel?.trim() || DEFAULT_SETTLEMENT_DOC.label, n, r.fileName),
      parents: [folderId],
      mimeType: r.contentType,
      // sid — 이 파일이 어느 정산의 것인가(D-117). 뺀 파일 정리가 이것으로 범위를 좁힌다
      appProperties: { rk: key, sid: st.id },
    },
    media: { mimeType: r.contentType, body: Readable.from(r.data) },
    fields: 'id',
  })
  return 'uploaded'
}

/**
 * 폴더 안에서 **이 정산(sid)의** 파일 중 현재 목록에 없는 것을 휴지통으로.
 *
 * 🔴 D-117 전에는 폴더 = 정산 1건이라 폴더 안 전부를 비교했다. 이제 한 폴더에 팀원들의
 *    여러 회차가 모이므로 **sid 가 이 정산인 파일만** 본다 — 안 그러면 2차를 반영할 때
 *    1차 파일이, 팀원 A 를 반영할 때 B 의 파일이 「뺀 파일」로 휴지통에 간다.
 *    sid 가 없는 파일(사람이 넣은 것 · D-117 전 폴더의 것)은 건드리지 않는다.
 */
async function trashStaleReceipts(drive: Drive, folderId: string, st: Settlement, current: ReceiptBlob[]) {
  const keys = new Set(current.map((r) => receiptKey(r.storagePath)))
  const res = await drive.files.list({
    q:
      `'${folderId}' in parents and trashed = false ` +
      `and appProperties has { key='sid' and value='${q(st.id)}' }`,
    fields: 'files(id, appProperties)',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  for (const f of res.data.files ?? []) {
    const ap = f.appProperties ?? {}
    if (ap.rk && keys.has(ap.rk)) continue
    await drive.files.update({
      fileId: f.id!,
      supportsAllDrives: true,
      requestBody: { trashed: true },
    })
  }
}

/**
 * 「정산」 탭이 없으면 만들고, 머리글이 다르면 다시 쓴다.
 * D-117 에 8열 → 10열로 바뀌었다 — 비어 있을 때만 쓰면 옛 머리글이 남는다(신청 탭 ensureHeaders 와 같은 방식).
 * 값 줄은 건드리지 않는다 — 옛 줄은 [지금 반영] 때 그 줄이 새 순서로 다시 써진다.
 */
async function ensureSettlementSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
): Promise<number> {
  const info = await sheetInfo(sheets, sheetId, SETTLEMENT_SHEET)
  let gid = info.gid
  if (!info.exists) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SETTLEMENT_SHEET } } }] },
    })
    gid = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
  }

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${SETTLEMENT_SHEET}'!A1:${SETTLEMENT_LAST_COL}1`,
  })
  const first = (head.data.values?.[0] ?? []).map(String)
  const same =
    first.length === SETTLEMENT_HEADERS.length && SETTLEMENT_HEADERS.every((h, i) => first[i] === h)
  if (!same) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${SETTLEMENT_SHEET}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SETTLEMENT_HEADERS] },
    })
  }
  await setupHeader(sheets, sheetId, gid, SETTLEMENT_HEADERS.length)
  return gid
}

/**
 * 한 줄의 링크 서식을 걷어 낸다 (D-117). 열이 바뀌어 옛 「폴더 열기」 링크가 다른 칸
 * (지금의 「증빙서류」)에 남는 것을 막는다 — 값을 다시 써도 셀 서식(링크)은 남기 때문.
 * 폴더 링크는 이 뒤에 linkCell 이 다시 건다.
 */
async function clearRowLinks(sheets: Sheets, spreadsheetId: string, gid: number, rowNo: number, columnCount: number) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: gid, startRowIndex: rowNo - 1, endRowIndex: rowNo, startColumnIndex: 0, endColumnIndex: columnCount },
            cell: { userEnteredFormat: { textFormat: { underline: false } } },
            fields: 'userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.underline',
          },
        },
      ],
    },
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
 * `unit`(팀명)은 부르는 쪽(API)이 **신청서·공고로 계산해** 넘긴다 — 정산 문서에는 팀명이
 * 없고, 제출하는 브라우저가 적은 값을 믿지 않는다(보안 점검 08 B).
 *
 * `DRIVE_SETTLEMENT_FOLDER_ID` 가 없으면 오류로 알린다 — 조용히 건너뛰면
 * 담당자는 "증빙서류가 왜 드라이브에 없지?"를 알 길이 없다. (연동 자체가
 * 설정되지 않은 경우만 신청서와 같이 건너뛴다.)
 */
export async function syncSettlement(
  st: Settlement,
  receipts: ReceiptBlob[],
  unit: SettlementUnit
): Promise<SettlementSyncResult> {
  const c = clients()
  if (!c) return { skipped: true, uploaded: 0 }
  const { cfg, sheets, drive } = c

  if (!cfg.settlementFolderId) {
    throw new Error(
      '[설정 없음] 정산 폴더 DRIVE_SETTLEMENT_FOLDER_ID 가 없습니다. ' +
        '공유 드라이브 「정산」 폴더 ID 를 Vercel 환경변수에 넣어 주세요.'
    )
  }

  // ── 드라이브: 정산 / 프로그램 / 팀(개인이면 사람) / 파일 ─────────
  const program = cleanName(st.programTitle || st.programId)
  const programFolder = await step('드라이브 폴더 · DRIVE_SETTLEMENT_FOLDER_ID 확인', () =>
    folderByName(drive, cfg.settlementFolderId!, program)
  )
  const folder = await step(unit.team ? '드라이브 팀 폴더' : '드라이브 사람 폴더', () =>
    unitFolder(drive, programFolder, st, unit)
  )
  // 종류 안에서 01·02 … — 목록 순서대로
  const perKind = new Map<string, number>()
  let uploaded = 0
  for (let i = 0; i < receipts.length; i++) {
    const label = receipts[i].docLabel?.trim() || DEFAULT_SETTLEMENT_DOC.label
    const n = (perKind.get(label) ?? 0) + 1
    perKind.set(label, n)
    const r = await step(`증빙서류 업로드 ${i + 1}/${receipts.length}`, () =>
      uploadReceipt(drive, folder.id, st, n, receipts[i])
    )
    if (r === 'uploaded') uploaded++
  }
  // 재제출 때 신청자가 뺀 파일 — 드라이브 사본을 휴지통으로 (09-12).
  // 원본 목록에 없는 파일이 드라이브에만 남으면 담당자가 낸 적 없는 서류를 본다.
  await step('뺀 증빙서류 정리', () => trashStaleReceipts(drive, folder.id, st, receipts))

  // ── 시트: 「정산」 탭 ────────────────────────────────────────
  const gid = await step('시트 「정산」 탭 · SHEET_ID 확인', () =>
    ensureSettlementSheet(sheets, cfg.sheetId)
  )

  const row = [
    st.id,
    st.programTitle || st.programId,
    unit.team || '',
    st.applicantName || '',
    `${settlementRoundOf(st)}차`,
    seoulStamp(st.submittedAt?.toDate?.()),
    settlementDocSummary(st.receipts),
    folder.url,
    SETTLEMENT_STATUS_LABEL[st.status] ?? st.status,
    seoulDate(st.paidAt?.toDate?.()),
  ]

  // 이미 줄이 있으면 **그 줄을 고친다** — 재제출·확인 완료·지급 완료가 같은 줄에 반영되게
  const existing = await step('시트 줄 찾기', () =>
    findSheetRow(sheets, cfg.sheetId, SETTLEMENT_SHEET, st.id, Number(st.sheetRowId) || 0)
  )
  if (existing > 1) {
    await step('시트 줄 갱신', () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: cfg.sheetId,
        range: `'${SETTLEMENT_SHEET}'!A${existing}:${SETTLEMENT_LAST_COL}${existing}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
    )
    await step('시트 줄 서식', () =>
      formatRow(sheets, cfg.sheetId, gid, existing, SETTLEMENT_HEADERS.length, SETTLEMENT_FIXED_WIDTHS, false)
    )
    await step('옛 링크 걷기', () => clearRowLinks(sheets, cfg.sheetId, gid, existing, SETTLEMENT_HEADERS.length))
    await step('폴더 링크', () => linkCell(sheets, cfg.sheetId, gid, existing, FOLDER_COL, folder.url, '폴더 열기'))
    await step('열 너비 맞춤', () =>
      fitColumns(sheets, cfg.sheetId, gid, SETTLEMENT_SHEET, SETTLEMENT_HEADERS.length, SETTLEMENT_FIXED_WIDTHS)
    )
    return { sheetRow: existing, driveUrl: folder.url, uploaded }
  }

  // 새 줄 — 끼워 넣기·값·서식·폴더 링크를 한 번에 (D-127)
  const rowNo = await step('시트에 줄 추가', () =>
    insertRowAfterLast(sheets, cfg.sheetId, SETTLEMENT_SHEET, gid, row, (r) => [
      ...rowFormatRequests(gid, r, SETTLEMENT_HEADERS.length, SETTLEMENT_FIXED_WIDTHS, false),
      linkCellRequest(gid, r, FOLDER_COL, folder.url, '폴더 열기'),
    ])
  )
  await step('열 너비 맞춤', () =>
    fitColumns(sheets, cfg.sheetId, gid, SETTLEMENT_SHEET, SETTLEMENT_HEADERS.length, SETTLEMENT_FIXED_WIDTHS)
  )

  return { sheetRow: rowNo, driveUrl: folder.url, uploaded }
}

/* =====================================================================
   산출물 — 시트 「산출물」 탭 한 줄 (D-76 · 09-17)

   **파일은 나가지 않는다.** 산출물은 사진·영상이라 크고, 나가는 개인정보가
   늘고, 담당자가 사이트에서 바로 볼 수 있다. 시트에는 현황 한 줄만 —
   누가·언제·몇 개·무슨 상태. 이름 대신 **팀명(개인이면 소속)** 을 적는다
   (반출 범위 문서 참고). 「사이트에서 열기」 링크는 담당자가 로그인해야 열린다.
   ===================================================================== */

const OUTPUT_SHEET = '산출물'
const OUTPUT_FIXED_WIDTHS: ColumnWidths = { 3: 260 }
const OUTPUT_LINK_COL = 8

const OUTPUT_HEADERS = [
  '제출번호',       // A
  '프로그램',       // B
  '팀 · 소속',      // C — 이름은 넣지 않는다
  '제목',           // D
  '제출 일시',      // E
  '수정',           // F — 'n회 · 마지막 시각'
  '파일 수',        // G
  '상태',           // H — 제출됨 / 추가 요청 / 내려짐
  '사이트에서 열기', // I
]

/** 「산출물」 탭이 없으면 만들고, 머리글이 비어 있으면 넣는다 */
async function ensureOutputSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
): Promise<number> {
  const info = await sheetInfo(sheets, sheetId, OUTPUT_SHEET)
  let gid = info.gid
  if (!info.exists) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: OUTPUT_SHEET } } }] },
    })
    gid = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
  }
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${OUTPUT_SHEET}'!A1:I1`,
  })
  if (!head.data.values?.[0]?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${OUTPUT_SHEET}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [OUTPUT_HEADERS] },
    })
  }
  await setupHeader(sheets, sheetId, gid, OUTPUT_HEADERS.length)
  return gid
}

export interface OutputSyncResult {
  skipped?: true
  sheetRow?: number
}

/**
 * 산출물 1건을 시트 「산출물」 탭에 반영한다. 몇 번 돌려도 결과가 같다 —
 * 줄이 있으면 그 줄을 고친다(다시 제출·추가 요청·내리기가 같은 줄에).
 * @param openUrl 담당자 화면 주소 — 로그인해야 열린다
 */
export async function syncOutput(o: Output, openUrl: string): Promise<OutputSyncResult> {
  const c = clients()
  if (!c) return { skipped: true }
  const { cfg, sheets } = c

  const gid = await step('시트 「산출물」 탭 · SHEET_ID 확인', () =>
    ensureOutputSheet(sheets, cfg.sheetId)
  )

  const edited = o.editCount ?? 0
  const status = o.hiddenByStaff ? '내려짐' : OUTPUT_STATUS_LABEL[o.status] ?? o.status
  const row = [
    o.id,
    o.programTitle || o.programId,
    o.teamName ? `${o.teamName} 팀` : o.authorAffiliation || '',
    o.title,
    seoulStamp(o.submittedAt?.toDate?.()),
    edited > 0 ? `${edited}회 · ${seoulStamp(o.lastEditedAt?.toDate?.())}` : '',
    String(o.files?.length ?? 0),
    status,
    openUrl,
  ]

  const existing = await step('시트 줄 찾기', () =>
    findSheetRow(sheets, cfg.sheetId, OUTPUT_SHEET, o.id, Number(o.sheetRowId) || 0)
  )
  const muted = Boolean(o.hiddenByStaff)
  if (existing > 1) {
    await step('시트 줄 갱신', () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: cfg.sheetId,
        range: `'${OUTPUT_SHEET}'!A${existing}:I${existing}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
    )
    await step('시트 줄 서식', () =>
      formatRow(sheets, cfg.sheetId, gid, existing, OUTPUT_HEADERS.length, OUTPUT_FIXED_WIDTHS, muted)
    )
    await step('링크', () => linkCell(sheets, cfg.sheetId, gid, existing, OUTPUT_LINK_COL, openUrl, '사이트에서 열기'))
    await step('열 너비 맞춤', () =>
      fitColumns(sheets, cfg.sheetId, gid, OUTPUT_SHEET, OUTPUT_HEADERS.length, OUTPUT_FIXED_WIDTHS)
    )
    return { sheetRow: existing }
  }

  // 새 줄 — 끼워 넣기·값·서식·링크를 한 번에 (D-127)
  const rowNo = await step('시트에 줄 추가', () =>
    insertRowAfterLast(sheets, cfg.sheetId, OUTPUT_SHEET, gid, row, (r) => [
      ...rowFormatRequests(gid, r, OUTPUT_HEADERS.length, OUTPUT_FIXED_WIDTHS, muted),
      linkCellRequest(gid, r, OUTPUT_LINK_COL, openUrl, '사이트에서 열기'),
    ])
  )
  await step('열 너비 맞춤', () =>
    fitColumns(sheets, cfg.sheetId, gid, OUTPUT_SHEET, OUTPUT_HEADERS.length, OUTPUT_FIXED_WIDTHS)
  )
  return { sheetRow: rowNo }
}

/* =====================================================================
   1:1 문의 → 시트 「문의」 탭 (D-93 · 09-18)

   담당자 알림 수단이다 — 사이트는 메일을 안 보내므로, 시트의 알림 규칙(도구 → 알림 설정)을
   켜 두면 새 줄이 들어올 때 담당자가 메일로 안다. 이름·이메일은 회원 문서에서 서버가 읽어
   적는다(문의 문서의 복사본이 아니라 원본). 답이 달리면 같은 줄을 고친다.
   ===================================================================== */

const INQUIRY_SHEET = '문의'
const INQUIRY_FIXED_WIDTHS: ColumnWidths = { 4: 320, 7: 320 }
const INQUIRY_LINK_COL = 8

const INQUIRY_HEADERS = [
  '문의번호',       // A
  '이름',           // B
  '이메일',         // C
  '제목',           // D
  '내용',           // E
  '문의 일시',      // F
  '상태',           // G — 답변 대기 / 답변 완료 / 종료
  '답변',           // H
  '사이트에서 열기', // I
]

async function ensureInquirySheet(sheets: Sheets, sheetId: string): Promise<number> {
  const info = await sheetInfo(sheets, sheetId, INQUIRY_SHEET)
  let gid = info.gid
  if (!info.exists) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: INQUIRY_SHEET } } }] },
    })
    gid = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
  }
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${INQUIRY_SHEET}'!A1:I1`,
  })
  if (!head.data.values?.[0]?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${INQUIRY_SHEET}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [INQUIRY_HEADERS] },
    })
  }
  await setupHeader(sheets, sheetId, gid, INQUIRY_HEADERS.length)
  return gid
}

export interface InquirySyncResult {
  skipped?: true
  sheetRow?: number
}

/**
 * 문의 1건을 「문의」 탭에 반영한다. 줄이 있으면 그 줄을 고친다(답변·상태가 같은 줄에).
 * @param who 회원 문서에서 읽은 이름·이메일 (서버가 넘긴다)
 */
export async function syncInquiry(
  i: Inquiry,
  who: { name: string; email: string },
  openUrl: string
): Promise<InquirySyncResult> {
  const c = clients()
  if (!c) return { skipped: true }
  const { cfg, sheets } = c

  const gid = await step('시트 「문의」 탭 · SHEET_ID 확인', () =>
    ensureInquirySheet(sheets, cfg.sheetId)
  )

  const row = [
    i.id,
    who.name,
    who.email,
    i.title,
    i.body,
    seoulStamp(i.createdAt?.toDate?.()),
    INQUIRY_STATUS_LABEL[i.status] ?? i.status,
    i.answer ? `${i.answer}\n(${seoulStamp(i.answeredAt?.toDate?.())})` : '',
    openUrl,
  ]

  const muted = i.status === 'closed'
  const existing = await step('시트 줄 찾기', () =>
    findSheetRow(sheets, cfg.sheetId, INQUIRY_SHEET, i.id, Number(i.sheetRowId) || 0)
  )
  if (existing > 1) {
    await step('시트 줄 갱신', () =>
      sheets.spreadsheets.values.update({
        spreadsheetId: cfg.sheetId,
        range: `'${INQUIRY_SHEET}'!A${existing}:I${existing}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })
    )
    await step('시트 줄 서식', () =>
      formatRow(sheets, cfg.sheetId, gid, existing, INQUIRY_HEADERS.length, INQUIRY_FIXED_WIDTHS, muted)
    )
    await step('링크', () => linkCell(sheets, cfg.sheetId, gid, existing, INQUIRY_LINK_COL, openUrl, '사이트에서 열기'))
    await step('열 너비 맞춤', () =>
      fitColumns(sheets, cfg.sheetId, gid, INQUIRY_SHEET, INQUIRY_HEADERS.length, INQUIRY_FIXED_WIDTHS)
    )
    return { sheetRow: existing }
  }

  // 새 줄 — 끼워 넣기·값·서식·링크를 한 번에 (D-127)
  const rowNo = await step('시트에 줄 추가', () =>
    insertRowAfterLast(sheets, cfg.sheetId, INQUIRY_SHEET, gid, row, (r) => [
      ...rowFormatRequests(gid, r, INQUIRY_HEADERS.length, INQUIRY_FIXED_WIDTHS, muted),
      linkCellRequest(gid, r, INQUIRY_LINK_COL, openUrl, '사이트에서 열기'),
    ])
  )
  await step('열 너비 맞춤', () =>
    fitColumns(sheets, cfg.sheetId, gid, INQUIRY_SHEET, INQUIRY_HEADERS.length, INQUIRY_FIXED_WIDTHS)
  )
  return { sheetRow: rowNo }
}

/* =====================================================================
   회원 → 시트 「회원」 탭 (D-125 · 10-03)

   반출 범위: docs/4-기록/02-시트-드라이브-반출-범위.md §1-5. 쓰임새는 회원 현황 집계·통계·검색.
   🔴 처리방침 개정(위탁 목록에 「회원 정보」)이 시행된 뒤에 켠다 — `MEMBER_SHEET_ENABLED`(lib/config/memberSheet).
   꺼져 있으면 아무것도 쓰지 않는다.

   · **자동** — 가입 완료·회원정보 수정 때 회원 화면이, 담당자 지정·회수 때 서버가 그 회원의 줄을 쓴다(`syncMember`)
   · **[전체 반영]** — 회원 관리 화면. 처음 한 번 + 어긋났을 때 고치기(`syncAllMembers`)
   · 테스트 계정은 쓰지 않는다(D-111). 테스트 계정이 된 회원의 줄 · 같은 회원번호의 두 번째 줄 · 사이트에서
     지워진 회원의 줄은 **[전체 반영]의 맨 끝에 한꺼번에 행 삭제**(아래 줄이 올라옴) — 「줄 찾기 → 쓰기」 사이에
     위 줄이 지워져 다른 줄을 덮어쓰는 드문 겹침을 줄이려고 지우는 일은 여기서만 한다
   · 🔴 **새 줄은 append 가 아니라 「A열 마지막 값 바로 아래」에** (10-03 sunbell — append 는 중간 빈 줄에
     끼워 쓸 수 있다). 처음엔 직접 쓰고 다시 읽어 확인했는데, D-127(10-07)부터 다른 탭과 같이 **빈 줄을 끼워
     넣고 채우기를 한 번에**(`insertRowAfterLast`) — 동시에 와도 덮어쓰지 않는다
   ===================================================================== */

const MEMBER_SHEET = '회원'

const MEMBER_HEADERS = [
  '회원번호',   // A — 자기 줄을 찾는 열쇠
  '가입 일시',  // B
  '구분',       // C — 일반 회원 / 담당자 (통계에서 담당자를 걸러내려고)
  '회원 유형',  // D
  '이름',       // E
  '소속',       // F
  '학과·전공',  // G
  '학번',       // H — 학생만
  '학년',       // I — 학생만 (학년별 통계 — 신청 탭처럼 「신분」 한 칸으로 합치지 않는다)
  '직위',       // J — 교원·일반
  '연락처',     // K
  '상태',       // L — 활동 / 탈퇴(줄 회색)
  '정보 수정',  // M
]
const MEMBER_LAST_COL = String.fromCharCode(64 + MEMBER_HEADERS.length) // 'M'
/** 머리글 줄 오른쪽 빈 칸 — 「마지막 전체 반영: 시각」. N 은 비워 표와 붙어 보이지 않게 */
const MEMBER_STAMP_CELL = 'O1'
/** Firebase uid 모양 — 이 모양이 아닌 A열 값(사람이 적은 메모 등)은 「지워진 회원」으로 보지 않고 건드리지 않는다 */
const UID_LIKE = /^[A-Za-z0-9]{20,40}$/

function memberRowValues(m: SupportUser): string[] {
  const type = memberTypeOf(m.memberType)
  const student = type === 'student'
  const created = m.createdAt?.toDate?.()
  const updated = m.updatedAt?.toDate?.()
  const edited = Boolean(created && updated && updated.getTime() - created.getTime() > 60_000)
  return [
    m.uid,
    seoulStamp(created),
    m.role === 'staff' ? '담당자' : '일반 회원',
    MEMBER_TYPE_LABEL[type],
    m.name ?? '',
    m.affiliation ?? '',
    m.major ?? '',
    student ? m.studentId ?? '' : '',
    student && m.grade ? GRADE_LABEL[m.grade] ?? m.grade : '',
    student ? '' : m.position ?? '',
    m.phone ?? '',
    m.status === 'withdrawn' ? '탈퇴' : '활동',
    edited ? seoulStamp(updated) : '',
  ]
}

async function ensureMemberSheet(sheets: Sheets, spreadsheetId: string): Promise<number> {
  const info = await sheetInfo(sheets, spreadsheetId, MEMBER_SHEET)
  let gid = info.gid
  if (!info.exists) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: MEMBER_SHEET } } }] },
    })
    gid = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
  }
  // 머리글이 다르면 다시 쓴다(열을 바꿨을 때 — 정산 탭과 같은 방식)
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${MEMBER_SHEET}'!A1:${MEMBER_LAST_COL}1`,
  })
  const current = (head.data.values?.[0] ?? []).map((v) => String(v ?? ''))
  if (current.join('|') !== MEMBER_HEADERS.join('|')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${MEMBER_SHEET}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [MEMBER_HEADERS] },
    })
  }
  await setupHeader(sheets, spreadsheetId, gid, MEMBER_HEADERS.length)
  return gid
}

/** A열 값(앞뒤 공백 제거) — 인덱스 0 이 1행(머리글). 길이 = 마지막으로 값이 있는 줄 번호 */
async function memberColumnA(sheets: Sheets, spreadsheetId: string): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${MEMBER_SHEET}'!A:A`,
    majorDimension: 'COLUMNS',
  })
  return (res.data.values?.[0] ?? []).map((v) => String(v ?? '').trim())
}

/** 줄 서식 요청 — 가운데 정렬, 탈퇴면 회색(취소된 신청 줄과 같은 색). 바탕색은 탈퇴 줄만 건드린다 */
function memberRowFormat(gid: number, fromRow: number, toRow: number, muted: boolean): object {
  const fmt: Record<string, unknown> = { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP' }
  let fields = 'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy'
  if (muted) {
    fmt.backgroundColor = { red: 0.93, green: 0.93, blue: 0.93 }
    fmt.textFormat = { foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 } }
    fields += ',backgroundColor,textFormat.foregroundColor'
  }
  return {
    repeatCell: {
      range: { sheetId: gid, startRowIndex: fromRow - 1, endRowIndex: toRow, startColumnIndex: 0, endColumnIndex: MEMBER_HEADERS.length },
      cell: { userEnteredFormat: fmt },
      fields: fields + ')',
    },
  }
}

export interface MemberSyncResult {
  skipped?: 'disabled' | 'not-configured'
  sheetRow?: number
}

/** 회원 1명의 줄 — 있으면 그 줄을 고치고, 없으면 맨 아래에 새로. 테스트 계정은 부르는 쪽이 거른다 */
export async function syncMember(m: SupportUser): Promise<MemberSyncResult> {
  if (!MEMBER_SHEET_ENABLED) return { skipped: 'disabled' }
  const c = clients()
  if (!c) return { skipped: 'not-configured' }
  const { cfg, sheets } = c
  const sid = cfg.memberSheetId

  const gid = await step('시트 「회원」 탭 · 회원 시트 ID 확인', () => ensureMemberSheet(sheets, sid))
  const row = memberRowValues(m)
  const muted = m.status === 'withdrawn'

  const colA = await step('시트 줄 찾기', () => memberColumnA(sheets, sid))
  const found = colA.findIndex((v, i) => i > 0 && v === m.uid)
  if (found <= 0) {
    // 새 줄 — 다른 탭과 같은 방식(D-127). 처음(D-125)에는 「마지막 값 아래에 쓰고 다시 읽어 확인」이었는데,
    // 먼저 쓴 쪽이 확인을 마친 직후 다른 가입이 같은 줄을 덮는 틈이 남아 끼워 넣기로 바꿨다
    const rowNo = await step('시트에 줄 추가', () =>
      insertRowAfterLast(sheets, sid, MEMBER_SHEET, gid, row, (r) => [memberRowFormat(gid, r, r, muted)])
    )
    await step('열 너비 맞춤', () => fitColumns(sheets, sid, gid, MEMBER_SHEET, MEMBER_HEADERS.length, {}))
    return { sheetRow: rowNo }
  }
  const rowNo = found + 1
  await step('시트 줄 갱신', () =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `'${MEMBER_SHEET}'!A${rowNo}:${MEMBER_LAST_COL}${rowNo}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    })
  )
  await step('시트 줄 서식', () =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [memberRowFormat(gid, rowNo, rowNo, muted)] },
    })
  )
  await step('열 너비 맞춤', () => fitColumns(sheets, sid, gid, MEMBER_SHEET, MEMBER_HEADERS.length, {}))
  return { sheetRow: rowNo }
}

export interface MemberFullSyncResult {
  skipped?: 'disabled' | 'not-configured'
  /** 고친 줄 + 새 줄 */
  written: number
  appended: number
  removed: { tester: number; duplicate: number; orphan: number }
  /** 시트에 줄이 있게 된 회원 — 부르는 쪽이 회원 문서에 반영 시각을 적는다 */
  syncedUids: string[]
}

/**
 * [전체 반영] — 지금 사이트의 회원 전부로 「회원」 탭을 맞춘다. 몇 번 불러도 결과가 같다.
 * API 를 몇 번만 부르도록 한꺼번에 쓴다(값 한 번 · 서식 한 번 · 행 삭제 한 번) — 줄마다 부르면 시트 사용 한도에 걸린다.
 */
export async function syncAllMembers(members: SupportUser[], at: Date): Promise<MemberFullSyncResult> {
  const empty: MemberFullSyncResult = { written: 0, appended: 0, removed: { tester: 0, duplicate: 0, orphan: 0 }, syncedUids: [] }
  if (!MEMBER_SHEET_ENABLED) return { ...empty, skipped: 'disabled' }
  const c = clients()
  if (!c) return { ...empty, skipped: 'not-configured' }
  const { cfg, sheets } = c
  const sid = cfg.memberSheetId

  const gid = await step('시트 「회원」 탭 · 회원 시트 ID 확인', () => ensureMemberSheet(sheets, sid))
  const testers = new Set(members.filter((m) => m.role === 'tester').map((m) => m.uid))
  const keep = members.filter((m) => m.role !== 'tester')
  const keepUids = new Set(keep.map((m) => m.uid))

  // 지금 시트의 줄을 한 번 읽어 — 회원별 첫 줄 · 지울 줄
  const colA = await step('시트 줄 읽기', () => memberColumnA(sheets, sid))
  const rowOf = new Map<string, number>()
  const removeRows: number[] = []
  const removed = { tester: 0, duplicate: 0, orphan: 0 }
  colA.forEach((v, i) => {
    if (i === 0 || !v) return
    const rowNo = i + 1
    if (testers.has(v)) {
      removeRows.push(rowNo)
      removed.tester++
    } else if (keepUids.has(v)) {
      if (rowOf.has(v)) {
        removeRows.push(rowNo)
        removed.duplicate++
      } else rowOf.set(v, rowNo)
    } else if (UID_LIKE.test(v)) {
      // 사이트에서 지워진 회원(시험 계정 정리 등)의 줄 — 사본만 남아 있으면 안 된다
      removeRows.push(rowNo)
      removed.orphan++
    }
  })

  // 값 — 있는 줄은 그 자리에, 없는 회원은 맨 아래부터 차례로
  let next = Math.max(2, colA.length + 1)
  let appended = 0
  const data = keep.map((m) => {
    let r = rowOf.get(m.uid)
    if (!r) {
      r = next++
      appended++
    }
    return { m, r }
  })
  if (data.length > 0) {
    await step('시트에 쓰기', () =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sid,
        requestBody: {
          valueInputOption: 'RAW',
          data: data.map(({ m, r }) => ({
            range: `'${MEMBER_SHEET}'!A${r}:${MEMBER_LAST_COL}${r}`,
            values: [memberRowValues(m)],
          })),
        },
      })
    )
  }

  // 서식 — 전부 가운데 정렬 한 번 + 탈퇴 줄 회색. 그다음 행 삭제(지우면 줄 번호가 바뀌므로 서식 뒤에, 아래에서 위로)
  const requests: object[] = []
  const lastRow = Math.max(next - 1, colA.length)
  if (lastRow >= 2) requests.push(memberRowFormat(gid, 2, lastRow, false))
  for (const { m, r } of data) if (m.status === 'withdrawn') requests.push(memberRowFormat(gid, r, r, true))
  for (const rowNo of [...removeRows].sort((a, b) => b - a)) {
    requests.push({
      deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: rowNo - 1, endIndex: rowNo } },
    })
  }
  if (requests.length > 0) {
    await step('시트 서식 · 줄 지우기', () =>
      sheets.spreadsheets.batchUpdate({ spreadsheetId: sid, requestBody: { requests } })
    )
  }

  await step('마지막 전체 반영 시각', () =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `'${MEMBER_SHEET}'!${MEMBER_STAMP_CELL}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[`마지막 전체 반영: ${seoulStamp(at)}`]] },
    })
  )
  await step('열 너비 맞춤', () => fitColumns(sheets, sid, gid, MEMBER_SHEET, MEMBER_HEADERS.length, {}))

  return { written: data.length, appended, removed, syncedUids: keep.map((m) => m.uid) }
}
