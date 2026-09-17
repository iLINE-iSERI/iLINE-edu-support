import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'

export const metadata = { title: '갤러리' }

/**
 * 갤러리 — **준비 중 화면** (09-12).
 *
 * 09-08에 내용이 없다는 이유로 메뉴에서 내렸는데, 09-12 iSERI 결정으로
 * **메뉴에는 두고 누르면 "준비 중"이 뜨게** 되돌렸다. 메뉴에 자리가 있어야
 * 이 사이트가 나중에 무엇을 보여줄지 이용자가 안다는 판단이다.
 * 대신 빈 목록이 아니라 **분명한 준비 중 안내**여야 고장으로 안 보인다.
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
      {/* 09-17 D-76: 참여자끼리 공유는 「산출물 제출」의 참여자 자료실에서 이미 된다.
          갤러리는 **로그인 없이 누구나** 보는 공개 공간으로 남겨 두는 자리.
          D-84: 표준 빈 상태 카드 — 「준비 중」 배지는 남긴다(메뉴에 두되 의도된 상태임을 밝힘),
          갈 곳(참여자 자료실)을 말만 하지 않고 버튼으로 준다 */}
      <div className="container-page py-10">
        <EmptyState
          variant="preparing"
          icon="images"
          badge="준비 중"
          title="곧 참여자들의 산출물이 이곳에 공개됩니다"
          description="수업 지도안·활동 사례 같은 산출물과 프로그램 활동 사진을 누구나 볼 수 있게 공개하는 공간입니다. 공개 여부는 만드신 분의 동의를 받아 정합니다."
          secondaryAction={{ label: '참여자 자료실 보기', href: '/outputs' }}
        />
      </div>
    </>
  )
}
