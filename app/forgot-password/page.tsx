'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import Field from '@/components/ui/Field'
import { resetPassword, authErrorMessage } from '@/lib/firebase/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await resetPassword(email)
      // 계정 존재 여부를 알려주지 않는다 — 가입 여부 노출 방지
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="비밀번호 재설정"
      desc="가입하신 이메일로 재설정 링크를 보내드립니다."
      footer={
        <Link href="/login" className="underline underline-offset-2">
          로그인으로 돌아가기
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl bg-brand-soft p-4 text-sm leading-relaxed text-ink">
          입력하신 주소로 재설정 메일을 보냈습니다. 메일이 보이지 않으면{' '}
          <strong>스팸함</strong>도 확인해 주세요.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="이메일"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && (
            <p role="alert" className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm text-status-revision">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? '전송 중…' : '재설정 메일 보내기'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
