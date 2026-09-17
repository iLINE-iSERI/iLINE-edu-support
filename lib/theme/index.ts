/**
 * 메뉴별 테마 (D-82 · 09-18 · 여섯 번째 지시서).
 *
 * 색을 "점"이 아니라 "면"으로 — 메뉴를 옮기면 절 제목 바·활성 메뉴 밑줄·아이콘 칩·페이지
 * 헤더 워시의 색이 **파랑 → 청록으로 좁게** 흐른다(사업소개 → 알림마당 순, 대메뉴 순서와 같음).
 * 바뀌는 것은 **장식뿐** — 버튼(파랑)과 상태 배지(접수중 청록·D-day 귤색)는 어느 화면에서나 같다.
 *
 * 경로 → 테마는 **여기 한 곳**에서만 정한다. prefix 매칭이라 `/notice/faq`, `/apply/abc` 는
 * 부모를 따른다. 없는 경로(로그인·약관·담당자…)는 반드시 'home'.
 * 실제 색 값은 globals.css 의 `body[data-theme=…]` 블록에 있다.
 */

export const THEMES = ['home', 'about', 'apply', 'outputs', 'reserve', 'gallery', 'notice'] as const
export type Theme = (typeof THEMES)[number]

/** 대메뉴 순서대로 — 파랑 → 청록. 이 순서를 바꾸지 않는다 */
const ROUTES: [prefix: string, theme: Theme][] = [
  ['/about', 'about'],
  ['/apply', 'apply'],
  ['/outputs', 'outputs'],
  ['/reserve', 'reserve'],
  ['/gallery', 'gallery'],
  ['/notice', 'notice'],
]

export function getThemeFromPath(pathname: string): Theme {
  for (const [prefix, theme] of ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return theme
  }
  return 'home'
}

/**
 * 하이드레이션 **전에** body 에 data-theme 를 붙이는 한 줄 스크립트 (layout.tsx 에서 inline).
 * 클라이언트 컴포넌트의 useEffect 로 붙이면 첫 그림에 홈 색이 잠깐 비친다.
 * ROUTES 와 같은 표를 문자열로 갖는다 — 위 표를 고치면 여기도 같이.
 */
export const THEME_BOOT_SCRIPT = `(function(){var p=location.pathname,m=${JSON.stringify(
  ROUTES
)},t='home';for(var i=0;i<m.length;i++){if(p===m[i][0]||p.indexOf(m[i][0]+'/')===0){t=m[i][1];break}}document.body.setAttribute('data-theme',t)})()`
