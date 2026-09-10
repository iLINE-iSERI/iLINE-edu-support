import type { Metadata, Viewport } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
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
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
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
