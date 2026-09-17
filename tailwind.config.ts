import type { Config } from 'tailwindcss'

/**
 * 창의재단 교원양성지원사업 — Tailwind 설정
 *
 * 색은 app/globals.css 의 CSS 변수(디자인 토큰)를 참조합니다.
 * 다크모드 대응이 토큰 한 곳에서 이뤄지도록 하기 위함입니다.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 사업 브랜드 — 09-18(D-81) 남색 → 파랑 (Gemini 지시서 §1). 600 = --brand.
        // 숫자 단계는 Tailwind blue 그대로라 `dark:bg-brand-900`(#1e3a8a, 옛 주색)이
        // 다크 모드 히어로 바탕으로 자연스럽게 남는다.
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: 'rgb(var(--brand) / <alpha-value>)',
          700: 'rgb(var(--brand-strong) / <alpha-value>)',
          800: '#1e40af',
          900: '#1e3a8a',
          // globals.css 의 --brand-soft. ⚠️ 09-14 까지 이 키가 없어서 `bg-brand-soft` 가
          // CSS 로 안 나갔다 — 홈 히어로·Badge·ConsentBlock 이 바탕색 없이 떠 있었다.
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
        },
        // 포인트 (09-18) — 청록 · 귤색 · 슬레이트. 뜻은 globals.css 주석
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
          ink: 'rgb(var(--warn-ink) / <alpha-value>)',
          soft: 'rgb(var(--warn-soft) / <alpha-value>)',
        },
        wait: {
          DEFAULT: 'rgb(var(--wait) / <alpha-value>)',
          soft: 'rgb(var(--wait-soft) / <alpha-value>)',
        },
        // 의미 색 — CSS 변수(R G B) 참조. `<alpha-value>` 덕에 `/12` 같은 투명도가 통한다
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--bg-elevated) / <alpha-value>)',
        subtle: 'rgb(var(--bg-subtle) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        'line-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        'ink-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'ink-subtle': 'rgb(var(--text-subtle) / <alpha-value>)',
        // 신청서 상태 (§4-4)
        status: {
          draft: 'rgb(var(--status-draft) / <alpha-value>)',
          submitted: 'rgb(var(--status-submitted) / <alpha-value>)',
          reviewing: 'rgb(var(--status-reviewing) / <alpha-value>)',
          revision: 'rgb(var(--status-revision) / <alpha-value>)',
          approved: 'rgb(var(--status-approved) / <alpha-value>)',
          rejected: 'rgb(var(--status-rejected) / <alpha-value>)',
        },
      },
      boxShadow: {
        // 카드 (지시서 §1) — 기본 / 링크 카드 호버
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.03)',
        'card-hover': '0 10px 20px -2px rgba(15, 23, 42, 0.06)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      maxWidth: {
        // 페이지 폭 — 큰 모니터에서는 단계적으로 넓힌다 (09-18 iSERI: "모니터가 바뀌니
        // 공백이 많아진다"). 값은 globals.css 의 .container-page 가 쓴다
        container: '1140px',
        'container-xl': '1320px',
        'container-2xl': '1480px',
      },
      screens: {
        // D-24 모바일 우선 — 기본이 좁은 화면, 여기서부터 확장
        sm: '640px',
        md: '820px',
        lg: '1024px',
        // 큰 모니터 (09-18) — 1440 이상은 폭을 한 단계, 1920 이상은 두 단계 넓힌다.
        // 글자 크기는 globals.css 의 html font-size 가 1440~2560 사이에서 16→18px 로 흐른다
        xl: '1440px',
        '2xl': '1920px',
      },
      minHeight: {
        touch: '44px', // 터치 타깃 최소 크기 (D-24)
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [
    // 공지·자료실 본문 등 리치 텍스트 렌더링용
    require('@tailwindcss/typography'),
  ],
}

export default config
