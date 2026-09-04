import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'

export const metadata = { title: '마이페이지' }

export default function MypagePage() {
  return (
    <>
      <PageHeader
        title="마이페이지"
        description="신청 현황과 제출 서류를 확인합니다."
      />
      <Placeholder
        phase="Phase 3"
        blockedBy="H-1 신청서 폼 명세"
        items={[
          '내 신청 현황 — 상태 뱃지 + 보완 요청 사유 (D-11)',
          '산출물 제출 (D-19) — 선정 이후 노출',
          '정산 증빙 제출 (D-19) — 정산 기간 개시 후 노출',
          '제출 서류 보관함',
          '회원정보 수정',
        ]}
      />
    </>
  )
}
