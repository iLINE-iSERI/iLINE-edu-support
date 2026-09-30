'use client'

/**
 * 이메일 인증 안내 카드 (09-30 · 순서표 10번).
 *
 * 새로 가입한 이메일 계정이 아직 인증 전일 때 — 막아 둔 화면(새 프로그램 신청 · 새 시설 예약 · 1:1 문의)과
 * 마이페이지 맨 위에 나온다. 기존 회원(09-30 21:20 전 가입)에게는 나오지 않는다(`needsEmailVerification`).
 *
 *   [인증했어요 — 확인]    Firebase 에 다시 묻는다. 화면으로 돌아오면 저절로도 묻는다(AuthProvider)
 *   [인증 메일 다시 보내기] 60초에 한 번. Firebase 도 너무 잦으면 막는다(too-many-requests)
 *   주소를 잘못 적었으면    문의처 — 이메일은 로그인 계정과 묶여 있어 본인이 못 바꾼다
 */

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { useAuth } from '@/components/auth/AuthProvider'
import { sendVerificationEmail, authErrorMessage } from '@/lib/firebase/auth'
import { SITE } from '@/lib/config/site'

export default function VerifyEmailNotice({
  reason,
  className = '',
}: {
  /** 이 화면에서 무엇이 막혔는지 한 문장 — 예: 「프로그램 신청은 이메일 인증을 마친 뒤에 할 수 있습니다.」 */
  reason?: string
  className?: string
}) {
  const { user, recheckEmail } = useAuth()
  const [busy, setBusy] = useState<'' | 'check' | 'send'>('')
  const [msg, setMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function check() {
    setBusy('check')
    setMsg('')
    try {
      const ok = await recheckEmail()
      // 인증됐으면 이 카드를 띄운 화면이 저절로 바뀐다 — 안 됐을 때만 말한다
      if (!ok) setMsg('아직 인증되지 않았습니다. 메일의 링크를 누른 뒤 다시 확인해 주세요.')
    } catch {
      setMsg('확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy('')
    }
  }

  async function resend() {
    if (!user) return
    setBusy('send')
    setMsg('')
    try {
      await sendVerificationEmail(user)
      setMsg('인증 메일을 다시 보냈습니다. 메일함과 스팸함을 확인해 주세요.')
      setCooldown(60)
    } catch (e) {
      setMsg(authErrorMessage(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div
      role="status"
      className={'rounded-2xl border border-warn/60 bg-warn-soft p-5 text-sm leading-relaxed ' + className}
    >
      <p className="font-bold text-warn-ink">📧 이메일 인증이 필요합니다</p>
      <p className="mt-1 text-ink-muted">
        <strong className="break-all text-ink">{user?.email}</strong> 로 보낸 메일의 링크를 누르시면 인증이
        끝납니다. {reason}
      </p>
      <p className="mt-1 text-xs text-ink-subtle">
        메일이 안 보이면 스팸함도 확인해 주세요. 링크를 누른 뒤 이 화면으로 돌아오면 저절로 확인됩니다.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={check} disabled={busy !== ''}>
          {busy === 'check' ? '확인 중…' : '인증했어요 — 확인'}
        </Button>
        <Button variant="secondary" onClick={resend} disabled={busy !== '' || cooldown > 0}>
          {busy === 'send'
            ? '보내는 중…'
            : cooldown > 0
              ? `다시 보내기 (${cooldown}초 뒤)`
              : '인증 메일 다시 보내기'}
        </Button>
      </div>
      {msg && <p className="mt-2 font-medium text-ink">{msg}</p>}

      <p className="mt-3 text-xs text-ink-subtle">
        이메일 주소를 잘못 적으셨다면 ☎ {SITE.contact.phone} ·{' '}
        <a className="underline" href={`mailto:${SITE.contact.email}`}>
          {SITE.contact.email}
        </a>{' '}
        로 알려 주세요.
      </p>
    </div>
  )
}
