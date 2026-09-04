import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'

export const metadata = { title: '갤러리' }

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        title="갤러리"
        description="사업 참여 교원이 만든 산출물과 활동 사진을 공유합니다."
      />
      <Placeholder
        phase="Phase 4′"
        items={[
          '산출물 — 지도안 · 영상 · 우수사례 (태그 필터 + 검색)',
          '활동사진 — 현장 스케치 그리드',
          '담당자가 공개 승인한 항목만 노출 (§4-3)',
          '* 초기 콘텐츠 확보 방안 확인 필요 (Q-12)',
        ]}
      />
    </>
  )
}
