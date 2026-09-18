import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import InquiryView from '@/components/inquiry/InquiryView'

export const metadata = { title: '1:1 문의' }

/**
 * 1:1 문의 (D-93 · 09-18) — 회원이 쓰고 담당자가 답한다. 알림마당 하위.
 * 로그인 전에는 안내 카드(왜 로그인이 필요한지) → 로그인 뒤 내 문의 목록 + 새 문의.
 */
export default function InquiryPage() {
  return (
    <>
      <PageHeader
        title="1:1 문의"
        description="사이트 이용이나 프로그램에 대해 궁금한 것을 남기면 담당자가 답을 답니다. 문의 내용은 본인과 담당자만 봅니다."
      />
      <NoticeNav />
      <div className="container-page py-10">
        <InquiryView />
      </div>
    </>
  )
}
