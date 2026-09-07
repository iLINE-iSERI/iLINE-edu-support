'use client'

/**
 * 인증 + 회원 자격 상태를 앱 전체에 제공한다.
 *
 * D-23: 두 가지를 구분해서 들고 있는 것이 핵심이다.
 *   user   — Firebase 인증 신원 (이 프로젝트 전용. iLINE과 별개 — D-25)
 *   member — 창의재단 회원 문서 (이게 있어야 이용 자격이 있다)
 *
 * 상태는 6가지다:
 *   loading      확인 중
 *   guest        로그인 안 함
 *   unregistered 로그인은 됐지만 창의재단 회원이 아님  ← 가입 2단계 미완료
 *   member       창의재단 회원
 *   withdrawn    탈퇴 처리된 회원
 *   error        회원 정보를 "확인하지 못함"           ← 아래 주석 참고
 *
 * ⚠️ `unregistered` 와 `error` 를 반드시 구분해야 한다.
 *    "회원이 아니다"와 "회원인지 확인하지 못했다"는 완전히 다르다.
 *    조회 실패를 미등록으로 처리하면, 이미 등록한 사람이 일시적인 오류
 *    (보안 규칙 미적용, 네트워크 끊김) 때문에 다시 등록하려다
 *    쓰기까지 막혀 아무것도 못 하게 된다.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, logOut as fbLogOut } from '@/lib/firebase/auth'
import { getMember } from '@/lib/firebase/members'
import { isFirebaseConfigured, getAuthClient } from '@/lib/firebase/config'
import { firebaseErrorKind, firestoreErrorMessage } from '@/lib/firebase/errors'
import type { SupportUser } from '@/lib/types'

export type AuthStatus =
  | 'loading'
  | 'guest'
  | 'unregistered'
  | 'member'
  | 'withdrawn'
  | 'error'

interface AuthContextValue {
  user: User | null
  member: SupportUser | null
  status: AuthStatus
  /** status === 'error' 일 때의 안내 문구 */
  errorMessage: string
  /** 보안 규칙 미적용으로 보이는가 — 설정 안내를 띄울지 판단 */
  isSetupIssue: boolean
  /** 회원 등록 직후 등 상태를 다시 읽어야 할 때 */
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  member: null,
  status: 'loading',
  errorMessage: '',
  isSetupIssue: false,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<SupportUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSetupIssue, setIsSetupIssue] = useState(false)

  /**
   * 마지막으로 시작한 조회의 번호.
   *
   * 조회가 겹칠 수 있다 — 로그인 직후에는 `onAuthChange` 와 `refresh()` 가
   * 거의 동시에 돌고, 로그아웃은 진행 중인 조회를 기다려 주지 않는다.
   * 번호를 안 붙이면 **늦게 끝난 쪽이 이긴다.** 로그아웃했는데 직전 조회가
   * 뒤늦게 도착해 다시 '회원'으로 돌아가는 식의 사고가 난다.
   * 자기 번호가 최신이 아니면 결과를 버린다.
   */
  const runId = useRef(0)

  const load = useCallback(async (u: User | null) => {
    const id = ++runId.current
    /** 이 조회가 아직 최신인가 — 아니면 결과를 반영하지 않는다 */
    const latest = () => id === runId.current

    setErrorMessage('')
    setIsSetupIssue(false)
    setUser(u)

    if (!u) {
      setMember(null)
      setStatus('guest')
      return
    }

    /**
     * ⚠️ 회원 문서를 읽는 동안 반드시 'loading' 으로 바꿔 둔다.
     *
     * 이게 없으면 로그인 직후 아래 경합이 생긴다.
     *   1) 인증은 끝났지만 getMember 응답은 아직 안 옴
     *   2) 그 사이 status 는 직전 값인 'guest' 그대로
     *   3) MemberGate 가 'guest' 를 보고 로그인 화면으로 되돌림
     *   → 사용자 눈에는 "로그인을 눌러도 아무 일도 안 일어남"으로 보인다.
     * 첫 Firestore 연결은 1초 안팎 걸리므로 이 창이 실제로 열린다.
     */
    setStatus('loading')

    try {
      const m = await getMember(u.uid)
      if (!latest()) return
      setMember(m)
      // 문서가 없다 = 확실히 미등록. 이때만 unregistered.
      if (!m) setStatus('unregistered')
      else if (m.status === 'withdrawn') setStatus('withdrawn')
      else setStatus('member')
    } catch (e) {
      if (!latest()) return
      // 조회 자체가 실패한 것은 "미등록"이 아니라 "확인 불가"다.
      const kind = firebaseErrorKind(e)
      setMember(null)
      setStatus('error')
      setErrorMessage(firestoreErrorMessage(e))
      setIsSetupIssue(kind === 'permission-denied')
      if (kind === 'permission-denied') {
        console.warn(
          '[iLINE] support_users 를 읽지 못했습니다. Firestore 보안 규칙이 아직 적용되지 않은 것으로 보입니다. 레포의 firestore.rules 를 콘솔에 통째로 붙여넣고 게시해 주세요.'
        )
      } else {
        console.error('[iLINE] 회원 정보 조회 실패:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.warn(
        '[iLINE] Firebase 환경변수가 없습니다. .env.local 을 설정하면 로그인 기능이 활성화됩니다.'
      )
      setStatus('guest')
      return
    }
    // setUser 는 load 안에서 한다 — 두 군데서 하면 갱신 순서가 엇갈린다
    const unsub = onAuthChange((u) => {
      void load(u)
    })
    return () => unsub()
  }, [load])

  /**
   * 회원 등록 직후 등 상태를 다시 읽어야 할 때.
   *
   * ⚠️ **`user` 상태 변수를 쓰지 않고 Firebase 에 직접 현재 계정을 묻는다.**
   *
   *    예전에는 `load(user)` 였는데, `user` 는 리액트 상태라 **호출한 쪽이
   *    붙잡고 있는 값이 한 박자 뒤처질 수 있다.** 가입 화면에서 정확히 그게
   *    터졌다 (09-07):
   *
   *      1) 가입 화면이 그려질 때는 아직 로그인 전 → 이 화면이 쥔 refresh 의
   *         `user` 는 **null**
   *      2) [가입 완료] → 계정 생성 → onAuthChange 가 돌아 회원 문서를 찾지만
   *         아직 안 만들어졌으므로 `unregistered`
   *      3) 회원 문서 저장
   *      4) `refresh()` → **1)의 낡은 null 로 조회** → `guest` 로 덮어씀
   *
   *    onAuthChange 는 이미 다 돌았으니 다시 불릴 일이 없고, 상태는 새로고침
   *    전까지 `guest` 로 **굳는다.** 가입은 됐는데 헤더는 로그아웃이고
   *    마이페이지는 막히는, 바로 그 증상이다.
   *
   *    `getAuthClient().currentUser` 는 SDK 가 로그인 즉시 갱신하므로
   *    한 박자 뒤처지지 않는다. 의존성에서 `user` 가 빠져 **refresh 함수
   *    자체도 안 바뀌게** 되고, 그래서 낡은 참조를 쥘 수가 없다.
   */
  const refresh = useCallback(async () => {
    const current = isFirebaseConfigured() ? getAuthClient().currentUser : null
    await load(current)
  }, [load])

  const logout = useCallback(async () => {
    await fbLogOut()
    // 진행 중이던 조회가 뒤늦게 도착해 '회원'으로 되돌리지 못하게 번호를 올린다
    runId.current++
    setUser(null)
    setMember(null)
    setStatus('guest')
    setErrorMessage('')
    setIsSetupIssue(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        member,
        status,
        errorMessage,
        isSetupIssue,
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
