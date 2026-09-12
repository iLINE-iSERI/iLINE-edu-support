/**
 * 서버 전용 설정값.
 *
 * ⚠️ 이 파일의 값은 **절대 브라우저로 내려가면 안 된다.**
 *    이름에 NEXT_PUBLIC_ 이 붙지 않은 환경변수는 서버에서만 읽힌다.
 *    클라이언트 컴포넌트에서 이 모듈을 import 하면 빌드가 깨지는데,
 *    그건 안전장치이지 버그가 아니다.
 *
 * 설정이 없으면 오류를 내지 않고 `null` 을 돌려준다.
 * 연동은 부가 기능이므로, 설정 전이라도 사이트는 정상 동작해야 한다.
 */

import 'server-only'

export interface GoogleConfig {
  projectId: string
  clientEmail: string
  privateKey: string
  sheetId: string
  driveFolderId: string
  /**
   * 영수증이 올라가는 `02_정산` 폴더 (09-12). **선택** — 없으면 정산 연동만
   * "설정 없음"으로 실패하고 신청서 연동은 그대로 돈다. 폴더 ID 하나를
   * 못 넣었다고 이미 돌던 연동까지 멈추면 안 되기 때문이다.
   */
  settlementFolderId: string | null
}

export function getGoogleConfig(): GoogleConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawKey = process.env.FIREBASE_PRIVATE_KEY
  const sheetId = process.env.SHEET_ID
  const driveFolderId = process.env.DRIVE_FOLDER_ID
  const settlementFolderId = process.env.DRIVE_SETTLEMENT_FOLDER_ID || null

  if (!projectId || !clientEmail || !rawKey || !sheetId || !driveFolderId) {
    return null
  }

  return {
    projectId,
    clientEmail,
    // 환경변수에는 줄바꿈을 넣을 수 없어 \n 문자열로 들어온다. 되돌린다.
    privateKey: rawKey.replace(/\\n/g, '\n'),
    sheetId,
    driveFolderId,
    settlementFolderId,
  }
}
