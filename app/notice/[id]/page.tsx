import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import NoticeDetail from '@/components/notice/NoticeDetail'

export const metadata = { title: '공지사항' }

export default function NoticeDetailPage() {
  return (
    <>
      <PageHeader title="알림마당" />
      <NoticeNav />

      <div className="container-page max-w-3xl py-10">
        <NoticeDetail />
      </div>
    </>
  )
}
