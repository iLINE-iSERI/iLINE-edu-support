import Link from 'next/link'
import { SITE } from '@/lib/config/site'
import CurrentProgramCard from '@/components/home/CurrentProgramCard'

/**
 * 사업 홈 (aiedu.iline.or.kr/)
 *
 * 한국장학재단 참고 — 공고·신청 동선을 위로, 안내는 그 아래.
 * 공고 배너는 09-12부터 실제 프로그램 목록을 읽는다 (CurrentProgramCard).
 */

const STEPS = [
  { n: '01', title: '회원가입', desc: '기본 정보 · 동의서 등록' },
  // ⚠️ '임시저장'이라고 적혀 있었는데 **그런 기능이 없다**(D-29).
  //    없는 기능을 안내하면 "저장했겠지" 하고 창을 닫는 사람이 생긴다.
  { n: '02', title: '신청서 작성', desc: '웹에서 바로 작성 · 제출' },
  // 결과는 공지사항의 선정자 목록으로 알린다 (D-46).
  { n: '03', title: '심사 · 선정', desc: '공지사항 · 마이페이지에서 확인' },
  { n: '04', title: '활동 · 정산', desc: '활동 후 계좌 등록 · 증빙 제출' },
]

const SHORTCUTS = [
  {
    href: '/about',
    title: '사업 소개',
    desc: '추진 체계와 지원 내용을 확인하세요',
  },
  // 시설 예약 (09-12, D-56) — 회원 혜택이라 이용 단계가 아니라 바로가기에 둔다
  {
    href: '/reserve',
    title: '시설 예약',
    desc: '사범대학 공부실을 회원 누구나 예약할 수 있습니다',
  },
  {
    href: '/notice',
    title: '공지 · 서식',
    desc: '공고문과 제출 서식을 내려받으세요',
  },
  // 갤러리 자리였다. 내용이 없어 메뉴에서 내리면서(09-08) 이 칸도 바꿨다.
  // **빈 화면으로 보내는 바로가기는 없느니만 못하다.**
  // 문의처는 09-07에 확정되어 실제로 눌러서 연락이 되는 곳이다.
  {
    href: '/notice/faq',
    title: '자주 묻는 질문 · 문의',
    desc: '궁금한 점을 찾아보거나 담당자에게 연락하세요',
  },
]

export default function SupportHomePage() {
  return (
    <>
      {/* 히어로 + 신청 CTA */}
      <section className="border-b border-line bg-brand-soft/60 dark:bg-brand-900/20">
        <div className="container-page py-12 sm:py-16">
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">
            {SITE.funder}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
            {SITE.programName}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
            프로그램 신청부터 정산, 공부실 예약까지 온라인으로 처리합니다.
          </p>

          {/* 지금 신청할 수 있는 공고 — 프로그램 목록에서 읽는다 */}
          <CurrentProgramCard />
        </div>
      </section>

      {/* 참여 절차 — 회원가입부터 정산까지 사업 전체 흐름.
          '신청 절차'였는데 신청 뒤 단계(심사·활동·정산)까지 담고 있어 이름을
          바꿨다 (09-12 iSERI). */}
      <section className="container-page py-12 sm:py-14">
        <h2 className="text-xl font-bold tracking-tight">참여 절차</h2>
        <p className="mt-1 text-sm text-ink-muted">회원가입부터 활동비 정산까지, 지원사업이 진행되는 순서입니다.</p>
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

      {/* 바로가기 — 위 절차와 구분되게 배경을 깔고 제목을 같은 크기로 (09-12 iSERI) */}
      <section className="border-t border-line bg-subtle">
        <div className="container-page py-12 sm:py-14">
          <h2 className="text-xl font-bold tracking-tight">바로가기</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      </section>
    </>
  )
}
