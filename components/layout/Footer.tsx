import Link from 'next/link'
import { SITE } from '@/lib/config/site'

/**
 * 푸터 (09-06 개정)
 *
 * 위: 사업 주체 — 제주대학교 · 한국과학창의재단, 그 아래 작게 운영 기관
 * 아래: **문의처를 눈에 보이게** 편다
 *
 * 문의처를 FAQ 안에만 두면 "어디로 물어보나"를 찾아 헤매게 된다.
 * 모든 화면 아래에 있으면 학생이 헤맬 일이 없다.
 */
export default function Footer() {
  return (
    // 딥 슬레이트 (D-82 §2.4) — 캔버스보다 밝은 흰 푸터는 위계가 뒤집혀 있었다. 페이지를 "닫는" 면.
    // 색은 라이트·다크 공통 고정값(토큰 아님). 글자 #94A3B8 on #0F172A ≈ 7.3:1
    <footer className="mt-16 bg-[#0F172A] text-[#94A3B8]">
      <div className="container-page space-y-6 py-10 text-sm">
        {/* ── 주체 ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-[#E2E8F0]">
              {SITE.university} · {SITE.funder}
            </p>
            <p className="mt-1 text-xs">{SITE.operator} 운영</p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="푸터">
            <a href={SITE.introUrl} className="text-[#CBD5E1] hover:text-white">
              iLINE 홈
            </a>
            <Link href="/notice/faq" className="text-[#CBD5E1] hover:text-white">
              자주 묻는 질문
            </Link>
            <Link href="/terms" className="text-[#CBD5E1] hover:text-white">
              이용약관
            </Link>
            <Link href="/privacy" className="font-medium text-[#CBD5E1] hover:text-white">
              개인정보처리방침
            </Link>
          </nav>
        </div>

        {/* ── 문의처 ───────────────────────────────────── */}
        <div className="border-t border-[#E2E8F0]/15 pt-5">
          <p className="text-xs font-semibold text-[#E2E8F0]">문의</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* 누르면 바로 메일·전화가 열린다 — 휴대폰에서 옮겨 적지 않게 */}
            <a
              href={`mailto:${SITE.contact.email}`}
              className="text-[#CBD5E1] hover:text-white hover:underline"
            >
              {SITE.contact.email}
            </a>
            <a
              href={`tel:${SITE.contact.phone.replace(/-/g, '')}`}
              className="text-[#CBD5E1] hover:text-white hover:underline"
            >
              {SITE.contact.phone}
            </a>
            <a
              href={SITE.contact.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-[#FEE500] px-3 py-1.5 text-xs font-bold text-[#191600] hover:brightness-95"
            >
              카카오톡 문의
            </a>
            <span className="text-xs">{SITE.contact.hours}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
