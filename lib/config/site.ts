/**
 * 사이트 공통 문구 — 한 곳에 모아둔다.
 *
 * ✅ 사업 명칭과 문의처가 확정되었습니다 (2026-09-06, 교수님 확인).
 *
 * 여기만 고치면 헤더·푸터·메타데이터·FAQ 문의 섹션이 한 번에 바뀝니다.
 * 화면마다 같은 문구를 적어두지 않는 이유가 이것입니다.
 */

export const SITE = {
  /** 화면에 노출되는 이름 — 헤더 로고, 메뉴, 메타데이터 (09-06 확정) */
  programName: '교원양성기관 교육과정개발 지원사업',

  /** 공문·약관에 쓰는 긴 이름 */
  programNameFull: '교원양성기관 교육과정개발 지원사업',

  /** 사업 총괄 기관 */
  funder: '한국과학창의재단',

  /** 운영 기관 */
  operator: '제주대학교 지능소프트웨어교육연구소',

  /** 소속 대학 */
  university: '제주대학교',

  /** 인트로 허브 (iLINE 레포가 담당하는 루트 도메인) */
  introUrl: process.env.NEXT_PUBLIC_INTRO_URL || 'https://iline.or.kr',

  /** 문의처 (09-06 확정) */
  contact: {
    email: 'ai_edu@jejunu.ac.kr',
    phone: '064-754-1876',
    /** 카카오톡 채널 — 학생들이 가장 편하게 쓰는 경로라 함께 노출한다 */
    kakaoUrl: 'http://pf.kakao.com/_xfxdMxaX',
    hours: '평일 09:00 ~ 18:00',
  },

  /** 개인정보 보유 기간 (사업 종료 후, 년) — 동의서 기준 */
  retentionYears: 3,
} as const

/** 문의처가 아직 등록되지 않았는지 */
export function hasContactInfo(): boolean {
  return Boolean(SITE.contact.email || SITE.contact.phone)
}
