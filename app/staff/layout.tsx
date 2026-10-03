import StaffNav from '@/components/staff/StaffNav'
import { TestViewProvider } from '@/components/staff/TestView'

/**
 * 관리 화면 공통 틀 (10-02 · D-122) — 모든 관리 화면 머리말 위에 관리 메뉴 줄.
 * 줄의 까닭과 모양은 `components/staff/StaffNav.tsx`. 권한 확인은 지금처럼 화면마다 `MemberGate`.
 * D-124 — 「시험 데이터 보기」 스위치 상태를 모든 관리 화면이 함께 쓴다(`components/staff/TestView.tsx`).
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <TestViewProvider>
      <StaffNav />
      {children}
    </TestViewProvider>
  )
}
