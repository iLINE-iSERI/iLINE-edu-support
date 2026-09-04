import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'

export const metadata = { title: '사업소개' }

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="사업소개"
        description="사업 개요와 추진 체계, 참여 자격 및 지원 내용을 안내합니다."
      />
      <Placeholder
        phase="Phase 1"
        items={[
          '사업 소개 — 목적·배경·주관',
          '추진 체계 및 일정 (타임라인 UI)',
          '참여 자격 및 지원 내용',
          '* 실제 문안은 공고문 수령 후 반영',
        ]}
      />
    </>
  )
}
