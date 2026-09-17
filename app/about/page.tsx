import PageHeader from '@/components/ui/PageHeader'
import { SITE } from '@/lib/config/site'

export const metadata = { title: '사업소개' }

/**
 * 사업소개 (D-13 · 대메뉴 1 · D-70 문안 확정)
 *
 * 09-14 iSERI 가 준 「AI 기본교육 비전 및 추진 체계」(사업계획서 1-1-3 가.)를
 * 바탕으로 문안을 짰다. 기준(iSERI 검수, 같은 날 2차 수정까지):
 *   · 계획서는 **방향성**이다. 수행과제 칸의 AI-TCA·AI-Insight 같은 이름은
 *     프로그램이 아니라 **카테고리**라, 여기 적지 않는다. 실제 프로그램은
 *     그 안에서 해마다 만들어지고 **공고**가 안내한다.
 *   · 그래서 "어떤 활동을 하나요" · 지원 내용(활동비 등) · 추진 일정은 **두지
 *     않는다** — 프로그램마다 다른 것을 전반적 소개에 담지 않는다.
 *   · 소제목은 계획서 용어(비전 · 인재상 · 목표 · 협력체계)를 그대로 쓴다 —
 *     사범대학 문서·공고와 같은 말이어야 같은 사업으로 읽힌다.
 *     계획서의 「추진방향」 대신 「목표」를 싣는다 — 인재상(포용·도전·소통)과
 *     짝이 맞아 화면이 한 줄기로 읽힌다 (iSERI 09-14).
 *   · 인재상·목표 문장은 계획서 그대로. 손대지 않는다.
 *   · 성과지표 · 위원회 · 산업체 · 교과목 개발 세부는 내부·평가용이라 뺀다.
 *     'AI 기본교육' 표기도 뺀다.
 *   · 페이지를 설명하는 부제("~를 안내합니다")는 두지 않는다 — 비전 아래
 *     문단과 겹친다. 그 문단에서 "~의 하나로"(다른 사업이 있나 싶게 함) ·
 *     주관/운영 구분(계획서에 없음, 협력체계가 대신함)은 뺐다.
 *   · 사업의 **지원 대상은 예비교원** — 별도 줄이 아니라 문단 안에 녹인다.
 *     프로그램별 신청 자격은 필요에 따라 일반 회원 등으로 넓힐 수 있어 각
 *     공고가 정하지만, 여기서는 언급하지 않는다 (iSERI 09-14).
 *   · 협력체계는 역할 구분 없이 기관 5곳만. 🔶 로고 원본 파일을 받으면
 *     PARTNERS 의 텍스트 타일을 로고로 바꾼다 — 그때까지는 기관명 텍스트.
 */

const VISION =
  '소통·도전·포용의 가치를 바탕으로, 지속적인 전문성 개발을 실천할 수 있는 미래 교사를 양성합니다.'

const IDEALS = [
  {
    name: '바다인',
    title: '포용하는 교사',
    desc: '인간 중심 가치와 윤리를 바탕으로 모든 학습자를 지원하는 교사',
  },
  {
    name: '오름인',
    title: '도전하는 교사',
    desc: '변화하는 교육환경 속에서 AI 기반 수업혁신을 실천하는 교사',
  },
  {
    name: '바람인',
    title: '소통하는 교사',
    desc: 'AI를 활용하여 학습자와 공감하고 협력하는 교사',
  },
]

/** 목표 — 계획서 문장 그대로. 순서가 인재상(포용·도전·소통)과 같다 */
const GOALS = [
  {
    lead: '기초 AI · 중등 AI 교육과정 기반의',
    title: 'AI 기술 포용형 예비교원 양성',
  },
  {
    lead: '실천적 AI 중심의 역량 강화를 통한',
    title: 'AI 융합 도전형 예비교원 양성',
  },
  {
    lead: '우수 사례 발굴 · 성과 확산을 통한',
    title: 'AI 가치 소통형 예비교원 양성',
  },
]

/** 협력체계 — 계획서 순서 그대로. 로고 파일이 오면 { name, logo } 로 바꾼다 */
const PARTNERS = [
  '제주대학교',
  '제주대학교 사범대학',
  '지능소프트웨어교육연구소',
  '제주특별자치도교육청',
  '제주지방기상청',
]

export default function AboutPage() {
  return (
    <>
      <PageHeader title="사업소개" />

      <div className="container-page space-y-14 py-10 sm:py-14">
        {/* 비전 */}
        <section aria-labelledby="about-vision">
          <div className="rounded-2xl border border-brand-200 bg-brand-soft px-6 py-8 text-center dark:border-brand-800 dark:bg-brand-900/20 sm:px-10 sm:py-10">
            <h2
              id="about-vision"
              className="text-sm font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300"
            >
              비전
            </h2>
            <p className="mx-auto mt-3 max-w-2xl break-keep text-lg font-bold leading-relaxed tracking-tight sm:text-xl">
              {VISION}
            </p>
          </div>

          <p className="mx-auto mt-8 max-w-3xl break-keep leading-relaxed text-ink-muted">
            {SITE.funder} {SITE.programName}은{' '}
            <strong className="font-semibold text-ink">예비교원</strong>이 AI
            시대의 교실을 준비할 수 있도록 지원합니다. 교육과정을 마련하고, 역량을
            키우는 프로그램을 운영하며, 그 성과를 학교와 지역에 확산합니다.
          </p>
        </section>

        {/* 인재상 */}
        <section aria-labelledby="about-ideals">
          <h2
            id="about-ideals"
            className="section-title"
          >
            인재상
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {IDEALS.map((p) => (
              <li
                key={p.name}
                className="rounded-xl border border-line bg-surface shadow-card p-5"
              >
                <p className="text-sm font-bold text-brand-600 dark:text-brand-300">
                  {p.name}
                </p>
                <p className="mt-1 text-base font-bold tracking-tight">
                  {p.title}
                </p>
                <p className="mt-2 break-keep text-sm leading-relaxed text-ink-muted">
                  {p.desc}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* 목표 — 계획서처럼 수단(작은 글) 위, 목표(굵은 글) 아래 */}
        <section aria-labelledby="about-goals">
          <h2
            id="about-goals"
            className="section-title"
          >
            목표
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {GOALS.map((g) => (
              <li
                key={g.title}
                className="rounded-xl border border-line bg-surface shadow-card p-5"
              >
                <p className="break-keep text-sm leading-relaxed text-ink-muted">
                  {g.lead}
                </p>
                <p className="mt-1.5 break-keep text-base font-bold tracking-tight">
                  {g.title}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* 협력체계 — 로고 자리. 파일이 올 때까지 기관명 텍스트 (09-14 iSERI) */}
        <section aria-labelledby="about-partners">
          <h2
            id="about-partners"
            className="section-title"
          >
            협력체계
          </h2>
          <ul className="mt-4 flex flex-wrap justify-center gap-3 rounded-2xl border border-line bg-subtle px-4 py-6 sm:gap-4 sm:px-6 sm:py-8">
            {PARTNERS.map((name) => (
              <li
                key={name}
                className="flex min-h-[3.25rem] items-center rounded-lg border border-line bg-surface px-5 text-sm font-semibold tracking-tight sm:text-[15px]"
              >
                {name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
