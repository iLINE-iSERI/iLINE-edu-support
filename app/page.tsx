import Link from 'next/link'

/**
 * 사업 홈 (support.iline.or.kr/)
 *
 * 한국장학재단 참고 — 공고·신청 동선을 위로, 안내는 그 아래.
 * ⏸ 공고 배너·일정은 Firestore 연동 전이라 예시 값이다.
 */

const STEPS = [
  { n: '01', title: '회원가입', desc: '창의재단 회원 등록' },
  { n: '02', title: '신청서 작성', desc: '웹에서 작성 · 임시저장' },
  { n: '03', title: '심사 · 선정', desc: '마이페이지에서 결과 확인' },
  { n: '04', title: '활동 · 정산', desc: '증빙 제출 · 산출물 공유' },
]

const SHORTCUTS = [
  {
    href: '/about',
    title: '사업 소개',
    desc: '추진 체계와 지원 내용을 확인하세요',
  },
  {
    href: '/notice',
    title: '공지 · 서식',
    desc: '공고문과 제출 서식을 내려받으세요',
  },
  {
    href: '/gallery',
    title: '갤러리',
    desc: '지도안과 활동 사진을 살펴보세요',
  },
]

export default function SupportHomePage() {
  return (
    <>
      {/* 히어로 + 신청 CTA */}
      <section className="border-b border-line bg-brand-soft/60 dark:bg-brand-900/20">
        <div className="container-page py-12 sm:py-16">
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">
            한국과학창의재단
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
            교원양성지원사업
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
            과제 신청부터 정산, 산출물 공유까지 온라인으로 처리합니다.
          </p>

          {/* 접수 현황 — ⏸ Firestore 연동 예정 */}
          <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-status-approved/10 px-2.5 py-1 text-xs font-bold text-status-approved">
                    접수중
                  </span>
                  <span className="text-xs text-ink-subtle">D-14</span>
                </div>
                <p className="mt-2 text-lg font-bold">
                  2026년 교원양성지원사업 과제 공모
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  접수기간 2026. 9. 1. ~ 9. 18. 18:00
                </p>
              </div>
              <Link
                href="/apply"
                className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 text-base font-bold text-white hover:bg-brand-700 sm:shrink-0"
              >
                신청하기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 신청 절차 */}
      <section className="container-page py-12 sm:py-14">
        <h2 className="text-xl font-bold tracking-tight">신청 절차</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <span className="text-xs font-bold text-brand-600 dark:text-brand-300">
                {s.n}
              </span>
              <p className="mt-1 font-bold">{s.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 바로가기 */}
      <section className="container-page pb-14">
        <div className="grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong hover:shadow-sm"
            >
              <p className="flex items-center gap-1.5 font-bold">
                {c.title}
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
