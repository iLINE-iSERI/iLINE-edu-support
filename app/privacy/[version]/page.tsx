import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { SITE } from '@/lib/config/site'
import { VERSIONS } from '@/lib/privacy/versions'
import PolicyBody from '../PolicyBody'

export const metadata = { title: '개인정보처리방침 (이전 판)' }

/** 이전 판 — 개정 이력에서 「이전 판 보기」로 온다. 현행 판과 같은 모양으로 그린다 */
export default function ArchivedPrivacyPage({ params }: { params: { version: string } }) {
  const v = VERSIONS[params.version]
  if (!v) notFound()

  return (
    <>
      <PageHeader
        title="개인정보처리방침 (이전 판)"
        description={`${SITE.programNameFull} 사이트 — ${v.effectiveDate} 시행 판입니다. 지금은 적용되지 않습니다.`}
      />
      <div className="container-page space-y-8 py-10">
        <p className="rounded-xl border border-line bg-subtle p-4 text-sm text-ink-muted">
          이 문서는 <strong>{v.effectiveDate}</strong>에 시행되었던 이전 판입니다. 현재 적용되는 방침은{' '}
          <Link href="/privacy" className="font-semibold underline underline-offset-2 hover:text-brand-600">
            현행 개인정보처리방침
          </Link>
          에서 확인하세요.
        </p>
        <p className="text-sm text-ink-subtle">시행일: {v.effectiveDate}</p>
        <PolicyBody sections={v.sections} />
      </div>
    </>
  )
}
