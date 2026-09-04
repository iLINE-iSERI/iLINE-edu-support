import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import EmptyState from '@/components/ui/EmptyState'

export const metadata = { title: '서식 자료실' }

/**
 * 서식 자료실 — 공고문(PDF), 제출 서식(HWP) 배포.
 *
 * ⏸ Storage(support/public/) 연동은 보안 규칙 적용 후.
 */
export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        title="알림마당"
        description="공지사항과 제출 서식, 자주 묻는 질문을 확인하세요."
      />
      <NoticeNav />

      <div className="container-page space-y-6 py-10">
        <p className="text-sm leading-relaxed text-ink-muted">
          신청·정산에 필요한 서식을 내려받으실 수 있습니다. 신청서 본문은 서식을
          내려받지 않고 <strong className="font-semibold text-ink">웹에서 직접 작성</strong>
          합니다.
        </p>

        <EmptyState
          title="등록된 자료가 없습니다"
          desc="공고문과 제출 서식이 준비되면 이곳에 게시됩니다."
        />
      </div>
    </>
  )
}
