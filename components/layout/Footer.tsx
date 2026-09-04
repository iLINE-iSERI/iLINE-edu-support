import Link from 'next/link'
import { SITE } from '@/lib/config/site'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-subtle">
      <div className="container-page flex flex-col gap-4 py-8 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-muted">
            {SITE.programName} · {SITE.funder}
          </p>
          <p className="mt-1">{SITE.operator} 운영</p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="푸터">
          <a href={SITE.introUrl} className="hover:text-ink">
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
