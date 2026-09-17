import Link from 'next/link'
import OpenPrograms from '@/components/home/OpenPrograms'
import SectionTitle from '@/components/ui/SectionTitle'

/**
 * 사업 홈 (aiedu.iline.or.kr/) — D-72 (09-15) 재구성
 *
 * 교수님(09-14): "메인이 어렵다 · 접수 중인 프로그램이 강조되게 · 참여 절차는 굳이?"
 *   → 첫 화면 = **지금 접수 중인 프로그램**(네이비 밴드, 최대 3개, 개수에 맞춰 칸이 늘어남)
 *   → 그 아래 바로가기 4개. **참여 절차 4단계는 뺐다**(iSERI 09-15 결정).
 *   → 사업명 히어로도 뺐다 — 헤더에 이미 있다.
 * 09-18 (D-81): 남색 밴드를 걷고 흰 히어로(왼쪽 소개 6 : 오른쪽 접수 카드 4)로.
 * 바로가기는 링크 카드(.card-link) — 올리면 살짝 떠오른다. 색·톤은 10-디자인-규칙 §2.
 */

/**
 * 바로가기 4장 — 라인 아이콘(Lucide 경로 인라인 · D-82 지시서 §3.2) + 틴트 칩.
 * 홈은 색상띠 전체를 보여 주는 자리라 파랑·청록을 **교차**(1·3 파랑, 2·4 청록).
 * 아이콘은 장식 — aria-hidden, 카드 제목이 이름을 맡는다.
 */
const SHORTCUTS: { href: string; title: string; desc: string; tone: 'blue' | 'teal'; icon: JSX.Element }[] = [
  {
    href: '/about',
    title: '사업 소개',
    desc: '사업의 비전과 인재상, 협력체계',
    tone: 'blue',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </>
    ),
  },
  // 시설 예약 (09-12, D-56) — 회원 혜택이라 바로가기에 둔다
  {
    href: '/reserve',
    title: '시설 예약',
    desc: '사범대학 공부실을 회원 누구나',
    tone: 'teal',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </>
    ),
  },
  {
    href: '/notice',
    title: '공지 · 서식',
    desc: '공고문과 제출 서식 내려받기',
    tone: 'blue',
    icon: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M16 13H8M16 17H8M10 9H8" />
      </>
    ),
  },
  // 갤러리 자리였다. 내용이 없어 메뉴에서 내리면서(09-08) 이 칸도 바꿨다.
  // **빈 화면으로 보내는 바로가기는 없느니만 못하다.**
  {
    href: '/notice/faq',
    title: '자주 묻는 질문 · 문의',
    desc: '궁금한 점, 담당자 연락처',
    tone: 'teal',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </>
    ),
  },
]

export default function SupportHomePage() {
  return (
    <>
      {/* 첫 화면 — 지금 접수 중인 프로그램 (없으면 그렇게 말한다) */}
      <OpenPrograms />

      {/* 바로가기 — 틴트 밴드(D-82 §2.3): 히어로(워시) → 접수 카드(캔버스) 다음 구간이라는 리듬 */}
      <section className="band-tint py-12 sm:py-[72px]" aria-labelledby="home-shortcuts">
        <div className="container-page">
        <SectionTitle id="home-shortcuts">바로가기</SectionTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group card-link block p-5"
            >
              <span className={'shortcut-icon ' + (c.tone === 'teal' ? 'is-teal' : 'is-blue')}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {c.icon}
                </svg>
              </span>
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
