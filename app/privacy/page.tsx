import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import { SITE } from '@/lib/config/site'
import { FACTS, SECTIONS, HISTORY } from '@/lib/privacy/current'
import { VERSIONS } from '@/lib/privacy/versions'
import PolicyBody from './PolicyBody'

export const metadata = { title: '개인정보처리방침' }

/**
 * 개인정보처리방침 — 현행 판 (D-77 · 2026. 9. 18. 게시).
 *
 * 문안은 `lib/privacy/current.ts` 에 있다. 이 파일은 그리기만 한다.
 * 「임시 문안」 표시는 09-18 게시하면서 뗐다 — 이제부터 바뀌는 것은 **개정 공지**로
 * 알리고 이전 판은 `/privacy/{시행일}` 에 남긴다 (개정 절차는 current.ts 머리 주석).
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="개인정보처리방침"
        description={`${SITE.programNameFull} 사이트의 개인정보 처리에 관한 안내입니다.`}
      />

      <div className="container-page space-y-8 py-10">
        <p className="text-sm text-ink-subtle">시행일: {FACTS.effectiveDate}</p>

        <PolicyBody sections={SECTIONS} />

        {/* 개정 이력 — 법 시행령 제31조: 변경 사유·내용을 공개하고 이전 판과 비교할 수 있게 */}
        <section aria-labelledby="privacy-history">
          <h2 id="privacy-history" className="text-base font-bold tracking-tight">
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
                        <Link href={`/privacy/${h.slug}`} className="text-xs font-semibold underline underline-offset-2 hover:text-brand-600">
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
