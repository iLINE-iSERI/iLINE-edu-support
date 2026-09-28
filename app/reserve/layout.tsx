import type { Metadata } from 'next'
import PageHeader from '@/components/ui/PageHeader'
import SubNav from '@/components/ui/SubNav'

export const metadata: Metadata = {
  title: '시설 예약',
}

/**
 * 시설 예약 — 상단 대메뉴 「시설 예약」 아래 두 화면 (화면 설계 §0).
 *   /reserve       예약하기
 *   /reserve/mine  내 예약
 */
const ITEMS = [
  { href: '/reserve', label: '예약하기' },
  { href: '/reserve/mine', label: '내 예약' },
] as const

export default function ReserveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="시설 예약"
        description="사범대학 시설을 예약할 수 있습니다. 평일 09:00~18:00, 공간마다 하루 한 건, 한 번에 최대 2시간."
      />
      <SubNav items={ITEMS} />
      {children}
    </>
  )
}
