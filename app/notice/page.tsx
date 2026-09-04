import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'

export const metadata = { title: '알림마당' }

export default function NoticePage() {
  return (
    <>
      <PageHeader
        title="알림마당"
        description="공지사항과 제출 서식, 자주 묻는 질문을 확인하세요."
      />
      <Placeholder
        phase="Phase 4′"
        items={[
          '공지사항',
          '서식 자료실 (.hwp / .pdf 배포)',
          'FAQ / 문의하기',
          '* 그뤠잇 /board/notice 관리자 UI 패턴 재사용',
        ]}
      />
    </>
  )
}
