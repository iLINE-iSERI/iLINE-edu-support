import type { Metadata, Viewport } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: {
    default: '교원양성지원사업 | iLINE',
    template: '%s | 교원양성지원사업',
  },
  description:
    '한국과학창의재단 교원양성지원사업 — 사업 안내, 과제 신청, 정산, 산출물 갤러리',
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
        <a href="#main" className="skip-link">
          본문 바로가기
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
