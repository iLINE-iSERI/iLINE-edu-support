/**
 * 사이트 공통 문구 — 한 곳에 모아둔다.
 *
 * ⚠️ 사업 정식 명칭이 아직 확정되지 않았습니다.
 *    신청서 양식 머리글은 「교원양성기관 개발지원 사업단」인데
 *    현재 사이트는 "교원양성지원사업"으로 되어 있습니다.
 *
 *    확정되면 **이 파일만 고치면** 헤더·푸터·메타데이터·안내문이
 *    한 번에 바뀝니다. 화면마다 찾아다닐 필요가 없습니다.
 *    (docs/TODO-later.md D항목)
 */

export const SITE = {
  /** 화면에 노출되는 짧은 이름 — 헤더 로고, 메뉴 등 */
  programName: '교원양성지원사업',

  /** 공문·약관에 쓰는 긴 이름 */
  programNameFull: '교원양성기관 개발지원 사업',

  /** 사업 총괄 기관 */
  funder: '한국과학창의재단',

  /** 운영 기관 */
  operator: '제주대학교 지능소프트웨어교육연구소',

  /** 소속 대학 */
  university: '제주대학교',

  /** 인트로 허브 (iLINE 레포가 담당하는 루트 도메인) */
  introUrl: process.env.NEXT_PUBLIC_INTRO_URL || 'https://iline.or.kr',

  /** 문의처 — ⏸ 확정 후 입력 */
  contact: {
    email: '',
    phone: '',
    hours: '평일 09:00 ~ 18:00',
  },

  /** 개인정보 보유 기간 (사업 종료 후, 년) — 동의서 기준 */
  retentionYears: 3,
} as const

/** 문의처가 아직 등록되지 않았는지 */
export function hasContactInfo(): boolean {
  return Boolean(SITE.contact.email || SITE.contact.phone)
}
