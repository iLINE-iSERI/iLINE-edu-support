import Link from 'next/link'

const INTRO_URL = process.env.NEXT_PUBLIC_INTRO_URL || 'https://iline.or.kr'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-subtle">
      <div className="container-page flex flex-col gap-4 py-8 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-muted">
            교원양성지원사업 · 한국과학창의재단
          </p>
          <p className="mt-1">
            제주대학교 지능소프트웨어교육연구소 운영
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="푸터">
          <a href={INTRO_URL} className="hover:text-ink">
            iLINE 홈
          </a>
          <Link href="/notice/faq" className="hover:text-ink">
            문의하기
          </Link>
          <Link href="/terms" className="hover:text-ink">
            이용약관
          </Link>
          <Link href="/privacy" className="font-medium hover:text-ink">
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </footer>
  )
}
