import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'

export const metadata = { title: '갤러리' }

/**
 * 갤러리 — **09-08 현재 상단 메뉴에서 내려가 있습니다.**
 *
 * 내용이 하나도 없는 상태라 메뉴에 두면 이용자가 고장으로 받아들입니다.
 * 교수님이 갤러리보다 시설 예약을 먼저 하기로 하셔서(D-47) 접수 개시까지
 * 채워질 가능성이 없어, `components/layout/Header.tsx` 의 NAV 에서 뺐습니다.
 *
 * **화면은 지우지 않았습니다.** 산출물이 쌓이면 NAV 에 한 줄만 되살리면
 * 됩니다. 다만 주소를 직접 아는 사람은 여기로 올 수 있으므로, 빈 화면 대신
 * 안내를 띄웁니다.
 *
 * 남은 판단: 공개 승인 주체(담당자/제출자) · 초기 콘텐츠 확보
 * → `docs/3-할일/02-답-기다리는-것.md`
 */
export default function GalleryPage() {
  return (
    <>
      <PageHeader
        title="갤러리"
        description="사업 참여자가 만든 산출물과 활동 사진을 공유하는 공간입니다."
      />
      <Placeholder
        title="아직 공개된 자료가 없습니다"
        desc="프로그램이 진행되고 산출물이 모이면 이곳에 공개됩니다. 공개 여부는 만드신 분의 동의를 받아 정합니다."
      />
    </>
  )
}
