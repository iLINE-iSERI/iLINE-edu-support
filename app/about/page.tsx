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
 *   · 협력체계는 역할 구분 없이 기관 5곳만.
 *
 * 협력체계 로고 (10-01 · 순서표 9번 — 다섯 곳 모두 사용 허락, 한 장 ⑩) — iSERI 가 시안 둘을 보고 정함:
 *   · **PC 는 시안 A** — 사업 추진체계도처럼 로고 위 + 이름표 아래(lg 네 칸 · md 두 칸)
 *   · **휴대폰은 시안 B** — 기관 이름이 든 가로 로고 타일(한 줄에 하나 · sm 부터 둘)
 *   · 제주대학교와 사범대학은 **한 칸** — 제주대 로고 + 이름표 「제주대학교·제주대학교 사범대학」(사범대학 로고는 따로 없다)
 *   · 연구소는 PC 도 **글자 로고(가로형)** — 세로형 파일은 글자 없는 심벌이라 추진체계도와 달라 뺐다(iSERI)
 *   · 기상청 로고 글자는 「기상청」이라 이름표·설명에 「제주지방기상청」
 *   · 로고 칸은 **어두운 화면에서도 흰 바탕** — 기관 로고는 흰 바탕용이라 어두운 바탕에서는 회색 글자가 안 보이고,
 *     기상청 파일은 JPG(흰 배경 포함)다
 *   · 파일은 `public/partners/` — 제주대·교육청은 기관이 준 PNG, 기상청은 기관이 준 JPG(한글 좌우),
 *     연구소는 연구소 누리집 「연구소 CI」 화면의 PNG
 *   · 이미지 도구 없이 넣어서 **화면에서 자른다**(`CropImg`) — 파일마다 실제 그림이 있는 테두리(`box`)를
 *     픽셀로 재어 둔 값이다(10-01 브라우저로 측정). 제주대 엠블럼 파일은 세 모양이 한 장이라 가운데만,
 *     교육청 엠블럼은 투명 여백, 기상청 JPG 는 흰 여백을 잘라 낸다. 원본을 다듬으면(.ai 에서 내보내기) box 를 파일 전체로
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
/**
 * 협력체계 — 한 칸에 한 기관(제주대학교 칸에 사범대학을 함께).
 *   pc     PC(시안 A)의 위쪽 로고 · name 은 그 아래 이름표
 *   mobile 휴대폰(시안 B)의 가로 로고 · caption 은 로고 아래 작은 글(로고에 없는 이름)
 *   size   파일의 가로×세로 · box 는 실제 그림이 있는 테두리 [왼, 위, 오른, 아래] (픽셀)
 *   cls    보이는 크기 — 둥근 엠블럼은 높이로, 가로 로고는 폭으로 정한다. 네 로고가 **비슷한 무게로**
 *          보이도록 눈으로 맞춘 값
 */
interface LogoCrop {
  src: string
  alt: string
  size: [number, number]
  box: [number, number, number, number]
  cls: string
}
const PARTNERS: { key: string; name: string; pc: LogoCrop; mobile: LogoCrop; caption?: string }[] = [
  {
    key: 'jnu',
    name: '제주대학교·제주대학교 사범대학',
    // 엠블럼 파일에 세 가지(글자 원 · 회색 원 · 테두리 원)가 가로로 있다 — 가운데(회색 원)만
    pc: { src: '/partners/jnu-emblem.png', alt: '제주대학교 엠블럼', size: [1850, 516], box: [679, 6, 1159, 486], cls: 'h-[92px]' },
    mobile: { src: '/partners/jnu-signature.png', alt: '제주대학교', size: [1587, 599], box: [0, 0, 1587, 599], cls: 'w-[150px]' },
    caption: '제주대학교 사범대학',
  },
  {
    key: 'iseri',
    name: '지능소프트웨어교육연구소',
    pc: { src: '/partners/iseri-ci.png', alt: '지능소프트웨어교육연구소', size: [700, 81], box: [0, 0, 700, 81], cls: 'w-[240px]' },
    mobile: { src: '/partners/iseri-ci.png', alt: '지능소프트웨어교육연구소', size: [700, 81], box: [0, 0, 700, 81], cls: 'w-[230px]' },
  },
  {
    key: 'jje',
    name: '제주특별자치도교육청',
    pc: { src: '/partners/jje-emblem.png', alt: '제주특별자치도교육청 엠블럼', size: [443, 443], box: [44, 44, 399, 399], cls: 'h-[92px]' },
    mobile: { src: '/partners/jje-signature.png', alt: '제주특별자치도교육청', size: [896, 168], box: [22, 4, 874, 165], cls: 'w-[190px]' },
  },
  {
    key: 'kma',
    name: '제주지방기상청',
    pc: { src: '/partners/kma-signature.jpg', alt: '기상청', size: [1580, 592], box: [149, 76, 1200, 490], cls: 'w-[176px]' },
    mobile: { src: '/partners/kma-signature.jpg', alt: '기상청', size: [1580, 592], box: [149, 76, 1200, 490], cls: 'w-[120px]' },
    caption: '제주지방기상청',
  },
]

/**
 * 파일의 일부(box)만 보이게 — 이미지 도구 없이 여백을 잘라 낸다.
 * 바깥 상자가 box 의 비율을 갖고, 안의 그림을 그만큼 키워 box 의 왼쪽 위가 상자 모서리에 오게 옮긴다.
 * 폭을 정하면(`w-…`) 높이는 비율로, 높이를 정하면(`h-…`) 폭이 비율로 따라온다. 좁으면 폭이 줄어든다(max-w-full)
 */
function CropImg({ logo }: { logo: LogoCrop }) {
  const [w] = logo.size
  const [x0, y0, x1, y1] = logo.box
  const bw = x1 - x0
  const bh = y1 - y0
  return (
    <span
      className={'relative block max-w-full shrink-0 overflow-hidden ' + logo.cls}
      style={{ aspectRatio: `${bw} / ${bh}` }}
    >
      <img
        src={logo.src}
        alt={logo.alt}
        loading="lazy"
        className="absolute h-auto max-w-none"
        style={{ width: `${(w / bw) * 100}%`, left: `${(-x0 / bw) * 100}%`, top: `${(-y0 / bh) * 100}%` }}
      />
    </span>
  )
}

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

        {/* 협력체계 — PC 는 엠블럼 + 이름표(시안 A), 휴대폰은 가로 로고(시안 B). 10-01 iSERI */}
        <section aria-labelledby="about-partners">
          <h2
            id="about-partners"
            className="section-title"
          >
            협력체계
          </h2>
          <div className="mt-4 rounded-2xl border border-line bg-subtle p-4 sm:p-6">
            {/* PC — 시안 A. 로고 칸은 어두운 화면에서도 흰 바탕(글자색도 고정) */}
            <ul className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
              {PARTNERS.map((p) => (
                <li
                  key={p.key}
                  className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 pb-4 pt-5"
                >
                  <div className="flex h-[104px] w-full items-center justify-center">
                    <CropImg logo={p.pc} />
                  </div>
                  <span className="mt-auto break-keep rounded-full bg-gray-100 px-4 py-1.5 text-center text-sm font-semibold leading-snug tracking-tight text-gray-800">
                    {p.name}
                  </span>
                </li>
              ))}
            </ul>

            {/* 휴대폰 — 시안 B. 가로 로고 · 로고에 없는 이름은 아래 작은 글 */}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
              {PARTNERS.map((p) => (
                <li
                  key={p.key}
                  className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <CropImg logo={p.mobile} />
                  {p.caption && (
                    <span className="text-xs font-semibold text-gray-600">{p.caption}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  )
}
