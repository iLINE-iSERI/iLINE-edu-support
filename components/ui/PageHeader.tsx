/**
 * 하위 페이지 공통 제목 영역 (09-18 · D-81).
 *
 * 그 메뉴의 테마 색 워시(D-82) + 아래 연한 선. 제목 앞에 테마 색 세로 바 — 캔버스가 회색(#F8FAFC)이 되면서
 * 옛 회색 띠(bg-subtle)는 바탕과 구분이 안 됐다. 09-17 iSERI: "회색 말고 조금 더 뚜렷하게".
 */
export default function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="page-header-wash">
      <div className="container-page py-8 sm:py-10">
        <div className="border-l-4 border-theme pl-4">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
