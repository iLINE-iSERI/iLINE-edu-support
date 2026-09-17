import type { Metadata, Viewport } from 'next'
// 글꼴 — Pretendard Variable 동적 서브셋 (09-15 · D-71 M-0).
// 이전에는 globals.css 의 --font-sans 에 이름만 있고 파일이 없어 OS 마다 다른
// 글꼴로 보였다. npm 패키지 `pretendard`(OFL)에서 CSS 를 불러오면 Next 가 92개
// 조각 파일을 함께 배포하고, 브라우저는 화면에 쓰인 글자 범위만 내려받는다
// (unicode-range). 외부 CDN 의존 없음. 규칙: docs/4-기록/10-디자인-규칙.md §1
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ThemeSync from '@/components/layout/ThemeSync'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { SITE } from '@/lib/config/site'

export const metadata: Metadata = {
  title: {
    default: `${SITE.programName} | iLINE`,
    template: `%s | ${SITE.programName}`,
  },
  // 검색 결과에 그대로 나오는 문장이다. 없는 기능(갤러리)을 넣지 않는다.
  description: `${SITE.funder} ${SITE.programName} — 사업 안내, 프로그램 신청, 활동비 정산`,
  robots: {
    // 신청자가 직접 유입되는 사이트라 색인 우선순위는 낮지만 차단하지는 않는다
    index: true,
    follow: true,
  },
}

// D-24: 모바일 반응형 필수
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 확대를 막지 않는다 (접근성)
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      {/* data-theme 는 메뉴별 테마(D-82) — 하이드레이션 전 스크립트가 붙이고 ThemeSync 가 따라간다 */}
      <body className="flex min-h-screen flex-col" data-theme="home">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <AuthProvider>
          <ThemeSync />
          <a href="#main" className="skip-link">
            본문 바로가기
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
