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
        // 사업 브랜드 (남색 계열) — iLINE의 청록과 구분
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
          // globals.css 의 --brand-soft (라이트 #e8edfa · 다크 #1a2748).
          // ⚠️ 09-14 까지 이 키가 없어서 `bg-brand-soft` 가 CSS 로 안 나갔다 —
          //    홈 히어로·Badge·ConsentBlock 이 라이트 모드에서 바탕색 없이 떠 있었다.
          //    var() 색이라 `/60` 같은 투명도 수식은 무시되고 원색이 쓰인다.
          soft: 'var(--brand-soft)',
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
