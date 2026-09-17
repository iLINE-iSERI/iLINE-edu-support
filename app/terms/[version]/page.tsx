import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { VERSIONS } from '@/lib/terms/versions'
import PolicyBody from '@/app/privacy/PolicyBody'

export const metadata = { title: '이용약관 (이전 판)' }

export default function ArchivedTermsPage({ params }: { params: { version: string } }) {
  const v = VERSIONS[params.version]
  if (!v) notFound()

  return (
    <>
      <PageHeader title="이용약관 (이전 판)" description={`${v.effectiveDate} 시행 판입니다. 지금은 적용되지 않습니다.`} />
      <div className="container-page space-y-8 py-10">
        <p className="rounded-xl border border-line bg-subtle p-4 text-sm text-ink-muted">
          이 문서는 <strong>{v.effectiveDate}</strong>에 시행되었던 이전 판입니다. 현재 적용되는 약관은{' '}
          <Link href="/terms" className="font-semibold underline underline-offset-2 hover:text-brand-600">
            현행 이용약관
          </Link>
          에서 확인하세요.
        </p>
        <p className="text-sm text-ink-subtle">시행일: {v.effectiveDate}</p>
        <PolicyBody sections={v.sections} />
      </div>
    </>
  )
}
