import PageHeader from '@/components/ui/PageHeader'
import DraftNotice from '@/components/ui/DraftNotice'
import { SITE } from '@/lib/config/site'

export const metadata = { title: '사업소개' }

/**
 * 사업소개 (D-13 · 대메뉴 1)
 *
 * ⏸ 문안은 공고문 수령 후 교체합니다. 구조는 확정입니다.
 *    교체할 내용은 DRAFT 상수 한 곳에 모아뒀습니다.
 */

const DRAFT = {
  purpose:
    '예비교원이 교육 현장에 나가기 전에 인공지능 교육을 직접 설계하고 실습해 볼 수 있도록 프로그램 참여와 자료 개발, 활동비를 지원합니다. 참여자가 만든 지도안과 활동 사례는 갤러리를 통해 공유됩니다.',
  // 대상 = 예비교원 (확정)
  target: ['교원양성기관 재학생 (예비교원)', '교육대학원 재학생'],
  support: [
    { label: '프로그램 참여', desc: 'AI 교육 관련 프로그램 참여 지원' },
    { label: '자료 개발', desc: '지도안·교구 등 수업 자료 개발 지원' },
    { label: '활동비', desc: '여비 등 활동에 필요한 실비 정산 지원' },
  ],
  schedule: [
    { period: '2026. 9.', title: '사업 공고 및 신청 접수', done: true },
    { period: '2026. 10.', title: '심사 및 참여자 선정', done: false },
    { period: '2026. 10. ~ 11.', title: '프로그램 참여 및 자료 개발', done: false },
    { period: '2026. 11.', title: '산출물 제출', done: false },
    { period: '2026. 12.', title: '정산 및 사업 종료', done: false },
  ],
}

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="사업소개"
        description={`${SITE.funder} ${SITE.programName}의 목적과 추진 체계, 참여 자격을 안내합니다.`}
      />

      <div className="container-page space-y-12 py-10 sm:py-12">
        <DraftNotice what="공고문" />

        {/* 사업 목적 */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">사업 목적</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-ink-muted">
            {DRAFT.purpose}
          </p>
        </section>

        {/* 참여 자격 */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">참여 자격</h2>
          <ul className="mt-3 space-y-2">
            {DRAFT.target.map((t) => (
              <li
                key={t}
                className="flex gap-2.5 leading-relaxed text-ink-muted"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-300"
                />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-subtle">
            신청은 <strong className="font-semibold text-ink-muted">개인 단위가 기본</strong>
            입니다. 팀으로 활동하시더라도 구성원이 각자 신청해 주세요. 다만{' '}
            <strong className="font-semibold text-ink-muted">단체 프로그램</strong>
            은 대표자가 팀원 명단과 함께 신청합니다. 프로그램별 세부 자격은 각
            공고를 확인해 주세요.
          </p>
        </section>

        {/* 지원 내용 */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">지원 내용</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            {DRAFT.support.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-line bg-surface p-5"
              >
                <dt className="font-bold">{s.label}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {s.desc}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 추진 일정 — 타임라인 */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">추진 일정</h2>
          <ol className="mt-4">
            {DRAFT.schedule.map((s, i) => {
              const last = i === DRAFT.schedule.length - 1
              return (
                <li key={s.title} className="flex gap-4">
                  <div className="flex flex-col items-center" aria-hidden="true">
                    <span
                      className={
                        'mt-1.5 size-3 shrink-0 rounded-full ring-4 ' +
                        (s.done
                          ? 'bg-brand-600 ring-brand-600/15 dark:bg-brand-300 dark:ring-brand-300/20'
                          : 'bg-line-strong ring-transparent')
                      }
                    />
                    {!last && <span className="w-px flex-1 bg-line" />}
                  </div>

                  <div className={last ? 'pb-0' : 'pb-7'}>
                    <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">
                      {s.period}
                    </p>
                    <p className="mt-0.5 font-medium">{s.title}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* 추진 체계 */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">추진 체계</h2>
          <div className="table-scroll mt-3">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <caption className="sr-only">기관별 역할</caption>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    기관
                  </th>
                  <th scope="col" className="py-3 font-semibold">
                    역할
                  </th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                <tr className="border-b border-line">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-medium text-ink"
                  >
                    {SITE.funder}
                  </th>
                  <td className="py-3">사업 총괄 · 예산 지원</td>
                </tr>
                <tr className="border-b border-line">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-medium text-ink"
                  >
                    {SITE.operator}
                  </th>
                  <td className="py-3">사업 운영 · 참여자 지원 · 성과 관리</td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-medium text-ink"
                  >
                    참여 학생 (예비교원)
                  </th>
                  <td className="py-3">프로그램 참여 · 자료 개발 · 산출물 제출</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
