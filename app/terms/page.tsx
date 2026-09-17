import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import { FACTS, SECTIONS, HISTORY } from '@/lib/terms/current'
import { VERSIONS } from '@/lib/terms/versions'
import PolicyBody from '@/app/privacy/PolicyBody'

export const metadata = { title: '이용약관' }

/**
 * 이용약관 — 현행 판 (D-78 · 2026. 9. 18. 게시). 문안은 `lib/terms/current.ts`.
 * 개정 이력·이전 판 구조는 개인정보처리방침과 같다.
 */
export default function TermsPage() {
  return (
    <>
      <PageHeader title="이용약관" description="교원양성지원사업 사이트 이용에 관한 약관입니다." />

      <div className="container-page space-y-8 py-10">
        <p className="text-sm text-ink-subtle">시행일: {FACTS.effectiveDate}</p>

        <PolicyBody sections={SECTIONS} />

        <section aria-labelledby="terms-history">
          <h2 id="terms-history" className="text-base font-bold tracking-tight">
            개정 이력
          </h2>
          <div className="table-scroll mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left text-xs text-ink-subtle">
                  <th className="py-2 pr-4 font-semibold">시행일</th>
                  <th className="py-2 pr-4 font-semibold">변경 내용</th>
                  <th className="py-2 font-semibold">보기</th>
                </tr>
              </thead>
              <tbody>
                {HISTORY.map((h, i) => (
                  <tr key={h.slug} className="border-b border-line">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-ink">{h.effectiveDate}</td>
                    <td className="py-2.5 pr-4 text-ink-muted">
                      {h.summary}
                      {h.noticeId && (
                        <>
                          {' · '}
                          <Link href={`/notice/${h.noticeId}`} className="underline underline-offset-2 hover:text-brand-600">
                            개정 공지
                          </Link>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5">
                      {i === 0 ? (
                        <span className="text-xs font-bold text-brand-600">현행</span>
                      ) : VERSIONS[h.slug] ? (
                        <Link href={`/terms/${h.slug}`} className="text-xs font-semibold underline underline-offset-2 hover:text-brand-600">
                          이전 판 보기
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
