'use client'

/**
 * 인증 + 회원 자격 상태를 앱 전체에 제공한다.
 *
 * D-23: 두 가지를 구분해서 들고 있는 것이 핵심이다.
 *   user   — Firebase 인증 신원 (그뤠잇과 공유)
 *   member — 창의재단 회원 문서 (이게 있어야 이용 자격이 있다)
 *
 * 그래서 상태는 3가지가 아니라 4가지다:
 *   loading      확인 중
 *   guest        로그인 안 함
 *   unregistered 로그인은 됐지만 창의재단 회원이 아님  ← 그뤠잇에서 넘어온 경우
 *   member       창의재단 회원
 *   withdrawn    탈퇴 처리된 회원
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
import type { SupportUser } from '@/lib/types'

export type AuthStatus =
  | 'loading'
  | 'guest'
  | 'unregistered'
  | 'member'
  | 'withdrawn'

interface AuthContextValue {
  user: User | null
  member: SupportUser | null
  status: AuthStatus
  /** 회원 등록 직후 등 상태를 다시 읽어야 할 때 */
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  member: null,
  status: 'loading',
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<SupportUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const load = useCallback(async (u: User | null) => {
    if (!u) {
      setMember(null)
      setStatus('guest')
      return
    }
    try {
      const m = await getMember(u.uid)
      setMember(m)
      if (!m) setStatus('unregistered')
      else if (m.status === 'withdrawn') setStatus('withdrawn')
      else setStatus('member')
    } catch (e) {
      // 조회 실패 시 회원으로 오인하지 않는다 — 안전한 쪽으로 떨어뜨린다
      console.error('회원 정보 조회 실패:', e)
      setMember(null)
      setStatus('unregistered')
    }
  }, [])

  useEffect(() => {
    // 환경변수가 없으면 인증을 시도하지 않는다.
    // (설정 전에도 공개 페이지는 정상 동작해야 하므로)
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
  }, [])

  return (
    <AuthContext.Provider value={{ user, member, status, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
