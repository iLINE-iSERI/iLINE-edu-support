import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import NoticeList from '@/components/notice/NoticeList'

export const metadata = { title: '공지사항' }

/**
 * 공지사항 목록.
 *
 * 제목과 하위 메뉴는 서버에서 그리고, 목록만 클라이언트 컴포넌트로 뺀다.
 * Firestore 조회가 브라우저에서 일어나기 때문이다.
 */
export default function NoticePage() {
  return (
    <>
      <PageHeader
        title="알림마당"
        description="공지사항과 제출 서식, 자주 묻는 질문을 확인하세요."
      />
      <NoticeNav />

      <div className="container-page py-10">
        <NoticeList />
      </div>
    </>
  )
}
