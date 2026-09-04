import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import EmptyState from '@/components/ui/EmptyState'

export const metadata = { title: '공지사항' }

/**
 * 공지사항 목록.
 *
 * ⏸ Firestore(support_notices) 연동은 보안 규칙 적용 후에 붙입니다.
 *    (docs/TODO-later.md A항목) 지금은 빈 상태 UI만 있습니다.
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
        <EmptyState
          title="등록된 공지사항이 없습니다"
          desc="사업 공고와 일정 변경 등 안내가 이곳에 게시됩니다."
        />
      </div>
    </>
  )
}
