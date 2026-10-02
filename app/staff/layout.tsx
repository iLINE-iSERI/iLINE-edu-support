import StaffNav from '@/components/staff/StaffNav'

/**
 * 관리 화면 공통 틀 (10-02) — 모든 관리 화면 머리말 위에 관리 메뉴 줄.
 * 줄의 까닭과 모양은 `components/staff/StaffNav.tsx`. 권한 확인은 지금처럼 화면마다 `MemberGate`.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffNav />
      {children}
    </>
  )
}
