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
        // 사업 브랜드 (남색 계열) — 그뤠잇의 청록과 구분
        brand: {
          50: '#eef2fb',
          100: '#e8edfa',
          200: '#c9d5f4',
          300: '#9db2e9',
          400: '#6b8ada',
          500: '#3b5fc0',
          600: '#1e3a8a',
          700: '#172e6e',
          800: '#132558',
          900: '#0f1d45',
        },
        // 의미 색 — CSS 변수 참조
        bg: 'var(--bg)',
        surface: 'var(--bg-elevated)',
        subtle: 'var(--bg-subtle)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        ink: 'var(--text)',
        'ink-muted': 'var(--text-muted)',
        'ink-subtle': 'var(--text-subtle)',
        // 신청서 상태 (§4-4)
        status: {
          draft: 'var(--status-draft)',
          submitted: 'var(--status-submitted)',
          reviewing: 'var(--status-reviewing)',
          revision: 'var(--status-revision)',
          approved: 'var(--status-approved)',
          rejected: 'var(--status-rejected)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      maxWidth: {
        container: '1140px',
      },
      screens: {
        // D-24 모바일 우선 — 기본이 좁은 화면, 여기서부터 확장
        sm: '640px',
        md: '820px',
        lg: '1024px',
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
