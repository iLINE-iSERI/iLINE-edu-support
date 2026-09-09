'use client'

/**
 * 회원정보 수정 (마이페이지 하위).
 *
 * ── 왜 만들었나 ──────────────────────────────────────────────
 * 지금까지는 수정 화면이 없어서, 학번을 잘못 쓴 사람이 **담당자에게
 * 문의**해야 했다. 접수가 시작되면 바로 터질 문제였다.
 *
 * 그리고 개인정보 보호법이 보장하는 **정정 요구권**과도 이어진다.
 * 처리방침에 "정정은 어떻게 하는가"를 적으려면 창구가 있어야 한다
 * (`docs/4-기록/07-개인정보-처리-사실-명세서.md` §4).
 *
 * ── 여기서 바꿀 수 없는 것 ───────────────────────────────────
 *  · **이메일** — 로그인 계정과 묶여 있다. 바꾸려면 인증 자체를 바꿔야 한다
 *  · **동의 이력** — 다시 받으면 동의 일시와 약관 버전이 오늘 것으로
 *    덮여 기록이 무의미해진다 (MemberInfoForm 의 askConsent 주석 참고)
 *  · **역할·상태** — 담당자 권한을 스스로 줄 수 없어야 한다
 *  이 셋은 화면에도 없고, **보안 규칙에서도 막는다.**
 *
 * ── 가장 중요한 안내 ─────────────────────────────────────────
 * **이미 제출한 신청서는 바뀌지 않는다.** 신청서는 제출 시점의 원본이라
 * 정보를 사본으로 들고 있기 때문이다(D-28). 이걸 말해주지 않으면
 * 신청자는 여기서 고치면 신청서도 고쳐지는 줄 안다.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import MemberGate from '@/components/auth/MemberGate'
import MemberInfoForm, {
  type MemberInfoValues,
} from '@/components/auth/MemberInfoForm'
import { useAuth } from '@/components/auth/AuthProvider'
import { updateMember } from '@/lib/firebase/members'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { memberTypeOf } from '@/lib/types'

export default function ProfileEditPage() {
  return (
    <MemberGate>
      <ProfileEditContent />
    </MemberGate>
  )
}

function ProfileEditContent() {
  const { member, user, refresh } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // MemberGate 를 통과했으면 회원 문서가 있다. 타입을 좁히기 위한 방어.
  if (!member || !user) return null

  async function handleSubmit(v: MemberInfoValues) {
    if (!user) return
    setError('')
    setBusy(true)
    try {
      await updateMember(user.uid, {
        memberType: v.memberType,
        name: v.name.trim(),
        affiliation: v.affiliation.trim(),
        major: v.major.trim(),
        studentId: v.studentId.trim(),
        grade: v.grade,
        position: v.position.trim(),
        phone: v.phone.replace(/[^0-9]/g, ''),
      })

      // 헤더·마이페이지가 들고 있는 회원 정보를 새로 읽어온다.
      // 이걸 빼면 저장은 됐는데 화면은 옛 값을 보여준다.
      await refresh()
      router.replace('/mypage?profile=saved')
    } catch (e) {
      console.error('[iLINE] 회원정보 수정 실패:', e)
      setError(firestoreErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="회원정보 수정"
        description="가입할 때 등록하신 정보를 고칠 수 있습니다."
      />

      <div className="mx-auto w-full max-w-2xl px-4 pb-16">
        {/* ⚠️ 이 안내가 이 화면에서 가장 중요하다. 위쪽에 둔다. */}
        <div className="rounded-2xl border border-line bg-subtle p-4 text-sm leading-relaxed">
          <p className="font-bold">이미 제출한 신청서는 바뀌지 않습니다.</p>
          <p className="mt-1 text-ink-muted">
            신청서는 <strong>제출하신 그 시점의 원본</strong>으로 보관됩니다.
            여기서 정보를 고쳐도 지난 신청서의 내용은 그대로 남습니다.
            제출한 신청서의 내용을 고쳐야 한다면 담당자에게 문의해 주세요.
          </p>
          <p className="mt-2 text-ink-muted">
            여기서 고친 내용은 <strong>앞으로 하시는 신청</strong>부터
            반영됩니다.
          </p>
        </div>

        {/* 바꿀 수 없는 것 — 화면에 이유와 함께 보여준다.
            칸만 없으면 "왜 안 보이지" 하고 문의하게 된다. */}
        <dl className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="w-24 shrink-0 text-ink-muted">이메일</dt>
            <dd className="font-medium">{member.email}</dd>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-subtle">
            이메일은 로그인 계정과 묶여 있어 여기서 바꿀 수 없습니다.
            변경이 필요하시면 담당자에게 문의해 주세요.
          </p>
        </dl>

        <div className="mt-6">
          <MemberInfoForm
            initial={{
              memberType: memberTypeOf(member.memberType),
              name: member.name,
              affiliation: member.affiliation,
              major: member.major,
              studentId: member.studentId,
              grade: member.grade,
              position: member.position,
              phone: member.phone,
            }}
            askConsent={false}
            submitLabel="저장"
            busy={busy}
            error={error}
            onSubmit={handleSubmit}
          />
        </div>

        {/* 유형을 바꾸면 안 쓰는 칸이 비워진다 — 미리 알려준다 */}
        <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
          가입 유형을 바꾸시면 그 유형에서 쓰지 않는 항목(학번·학년 또는
          직위)은 <strong>비워져서 저장됩니다.</strong>
        </p>

        <div className="mt-6 text-center">
          <Link
            href="/mypage"
            className="text-sm text-ink-muted underline underline-offset-2"
          >
            취소하고 돌아가기
          </Link>
        </div>
      </div>
    </>
  )
}
