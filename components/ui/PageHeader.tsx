/** 하위 페이지 공통 제목 영역 */
export default function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="border-b border-line bg-subtle">
      <div className="container-page py-8 sm:py-10">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
