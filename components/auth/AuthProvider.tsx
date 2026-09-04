'use client'

/**
 * 인증 + 회원 자격 상태를 앱 전체에 제공한다.
 *
 * D-23: 두 가지를 구분해서 들고 있는 것이 핵심이다.
 *   user   — Firebase 인증 신원 (그뤠잇과 공유)
 *   member — 창의재단 회원 문서 (이게 있어야 이용 자격이 있다)
 *
 * 상태는 6가지다:
 *   loading      확인 중
 *   guest        로그인 안 함
 *   unregistered 로그인은 됐지만 창의재단 회원이 아님  ← 그뤠잇에서 넘어온 경우
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
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, logOut as fbLogOut } from '@/lib/firebase/auth'
import { getMember } from '@/lib/firebase/members'
import { isFirebaseConfigured } from '@/lib/firebase/config'
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

  const load = useCallback(async (u: User | null) => {
    setErrorMessage('')
    setIsSetupIssue(false)

    if (!u) {
      setMember(null)
      setStatus('guest')
      return
    }

    try {
      const m = await getMember(u.uid)
      setMember(m)
      // 문서가 없다 = 확실히 미등록. 이때만 unregistered.
      if (!m) setStatus('unregistered')
      else if (m.status === 'withdrawn') setStatus('withdrawn')
      else setStatus('member')
    } catch (e) {
      // 조회 자체가 실패한 것은 "미등록"이 아니라 "확인 불가"다.
      const kind = firebaseErrorKind(e)
      setMember(null)
      setStatus('error')
      setErrorMessage(firestoreErrorMessage(e))
      setIsSetupIssue(kind === 'permission-denied')
      if (kind === 'permission-denied') {
        console.warn(
          '[iLINE] support_users 를 읽지 못했습니다. Firestore 보안 규칙이 아직 적용되지 않은 것으로 보입니다. firebase-deploy/ 의 병합본을 게시해 주세요.'
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
    const unsub = onAuthChange(async (u) => {
      setUser(u)
      await load(u)
    })
    return () => unsub()
  }, [load])

  const refresh = useCallback(async () => {
    await load(user)
  }, [load, user])

  const logout = useCallback(async () => {
    await fbLogOut()
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
