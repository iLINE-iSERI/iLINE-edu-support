import type { Metadata } from 'next'
import PageHeader from '@/components/ui/PageHeader'
import SubNav from '@/components/ui/SubNav'

export const metadata: Metadata = { title: '예약 관리' }

/**
 * 담당자 — 시설 예약 관리 (2단계). 화면 넷 (화면 설계 §3~§6).
 *   /staff/reservations           행정실 전달 명단 ← 목요일 업무 그 자체
 *   /staff/reservations/board     예약 현황 (오늘 / 날짜별)
 *   /staff/reservations/add       직접 예약 추가 (단체대관·당일·주말·야간)
 *   /staff/reservations/settings  운영 설정 (마감·전달 요일, 범위, 휴관일)
 */
const ITEMS = [
  { href: '/staff/reservations', label: '행정실 전달 명단' },
  { href: '/staff/reservations/board', label: '예약 현황' },
  { href: '/staff/reservations/add', label: '직접 예약 추가' },
  { href: '/staff/reservations/settings', label: '운영 설정' },
] as const

export default function StaffReservationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="예약 관리"
        description="회원의 예약을 모아 매주 행정실에 사용 요청을 보내고, 시스템 밖에서 정해진 이용(단체대관·당일·주말)을 화면에 반영합니다."
      />
      <SubNav items={ITEMS} />
      {children}
    </>
  )
}
