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
}

export function getGoogleConfig(): GoogleConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawKey = process.env.FIREBASE_PRIVATE_KEY
  const sheetId = process.env.SHEET_ID
  const driveFolderId = process.env.DRIVE_FOLDER_ID

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
  }
}
