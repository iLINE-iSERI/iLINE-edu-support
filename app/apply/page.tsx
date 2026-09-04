import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'

export const metadata = { title: '프로그램 신청' }

export default function ApplyPage() {
  return (
    <>
      <PageHeader
        title="프로그램 신청"
        description="신청 안내와 절차를 확인하고 신청서를 작성합니다."
      />
      <Placeholder
        phase="Phase 3"
        blockedBy="H-1 신청서 폼 명세"
        items={[
          '신청 안내 및 절차',
          '신청서 작성 — 다단계 폼 + 임시저장',
          '증빙 첨부 (신분증 등, 최소화 원칙 D-3)',
          '신청서 미리보기 / 인쇄 · PDF 자동 생성',
          '* 폼 필드 확정 전까지 셸만 구현',
        ]}
      />
    </>
  )
}
