'use client'

/**
 * 담당자 「회원 관리」 — 회원 정보 **보기 전용** (D-114 · 09-28)
 *
 * 담당자가 "이 사람이 누구고 무엇을 냈나"를 콘솔 없이 보는 곳이다. 지금까지는 신청 목록의
 * 제출 시점 사본이나 Firebase 콘솔(개인정보가 통째로 열린다)밖에 없었다.
 *
 * **아무것도 고치지 않는다.** 회원 정보 수정 · 탈퇴 처리 · 담당자/테스트 계정 지정은 여기 없다 —
 * 급한 대로 보기만 먼저(iSERI 09-28). 테스트 계정 지정은 지금처럼 `scripts/grant-tester.mjs`.
 * 그래서 규칙 변경도 없다(담당자는 이미 회원 목록을 읽을 수 있다 — `allow list: if isStaff()`).
 *
 * ⚠️ 나중에 여기에 「일반 ↔ 테스트」 스위치를 붙일 때: **신청이 있는 회원은 막아야 한다.**
 *    테스트 표시는 한 번 붙으면 떨어지지 않아(D-111 보강) 실수로 바꿨다 되돌려도 그 사이 상태를
 *    바꾼 신청은 시트에서 영영 빠진다. 그리고 지금 규칙은 담당자가 회원 문서의 **어떤 칸이든**
 *    고칠 수 있으니 역할을 바꾸는 버튼을 만들면 규칙도 좁힐 것.
 *
 * 시트로 내보내지 않는다. 내려받기도 없다.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import MemberGate from '@/components/auth/MemberGate'
import { APPLICATION_TONE } from '@/lib/ui/statusTone'
import { listMembers } from '@/lib/firebase/members'
import { listAllApplications } from '@/lib/firebase/staff'
import { formatDate, formatDateTime } from '@/lib/firebase/programs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import {
  APPLICATION_STATUS_LABEL,
  MEMBER_TYPE_LABEL,
  identityLine,
  memberTypeOf,
  profileRows,
  type Application,
  type ConsentPurpose,
  type MemberType,
  type SupportUser,
} from '@/lib/types'

/** 「구분」 거르기 — 역할과 탈퇴를 한 줄로 */
type Kind = '' | 'applicant' | 'tester' | 'staff' | 'withdrawn'
const KIND_LABEL: Record<Exclude<Kind, ''>, string> = {
  applicant: '일반 회원',
  tester: '테스트 계정',
  staff: '담당자',
  withdrawn: '탈퇴',
}

function kindOf(m: SupportUser): Exclude<Kind, ''> {
  if (m.status === 'withdrawn') return 'withdrawn'
  if (m.role === 'staff') return 'staff'
  if (m.role === 'tester') return 'tester'
  return 'applicant'
}

const CONSENT_LABEL: Record<ConsentPurpose, string> = {
  personal_info: '개인정보 수집·이용',
  // 아래 둘은 옛 가입 단계에서 받던 것 — 지금은 읽지 않는다(초상권은 신청서마다 · D-44)
  portrait: '초상권 (옛 가입 단계 기록)',
  identity_document: '증빙 서류 (없어진 항목)',
}

const PROVIDER_LABEL: Record<string, string> = {
  google: '구글 계정',
  password: '이메일·비밀번호',
}

export default function StaffMembersPage() {
  return (
    <MemberGate requireStaff>
      <StaffMembersContent />
    </MemberGate>
  )
}

function StaffMembersContent() {
  const [members, setMembers] = useState<SupportUser[] | null>(null)
  const [appsByUid, setAppsByUid] = useState<Map<string, Application[]>>(new Map())
  const [error, setError] = useState('')
  const [appsError, setAppsError] = useState('')

  const [q, setQ] = useState('')
  const [type, setType] = useState<MemberType | ''>('')
  const [kind, setKind] = useState<Kind>('')

  useEffect(() => {
    listMembers()
      .then(setMembers)
      .catch((e) => {
        console.error('[iLINE] 회원 목록 조회 실패:', e)
        setError(firestoreErrorMessage(e))
        setMembers([])
      })
    // 신청 이력은 따로 — 실패해도 회원 목록은 보이게
    listAllApplications()
      .then((apps) => {
        const map = new Map<string, Application[]>()
        for (const a of apps) {
          const list = map.get(a.uid) ?? []
          list.push(a)
          map.set(a.uid, list)
        }
        setAppsByUid(map)
      })
      .catch((e) => {
        console.error('[iLINE] 신청 목록 조회 실패:', e)
        setAppsError('신청 이력을 불러오지 못했습니다. 새로고침해 주세요.')
      })
  }, [])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const digits = needle.replace(/[^0-9]/g, '')
    return (members ?? []).filter((m) => {
      if (type && memberTypeOf(m.memberType) !== type) return false
      if (kind && kindOf(m) !== kind) return false
      if (!needle) return true
      const hay = [m.name, m.email, m.affiliation, m.major, m.studentId]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ')
      // 전화는 숫자만 저장돼 있다 — 010-1234 처럼 쳐도 찾게
      return hay.includes(needle) || (digits.length >= 3 && String(m.phone ?? '').includes(digits))
    })
  }, [members, q, type, kind])

  const typeCounts = useMemo(() => {
    const c: Record<MemberType, number> = { student: 0, teacher: 0, general: 0 }
    for (const m of members ?? []) c[memberTypeOf(m.memberType)]++
    return c
  }, [members])

  const filtered = Boolean(q.trim() || type || kind)

  return (
    <>
      <PageHeader
        title="회원 관리"
        description="가입한 회원의 정보와 신청 이력을 봅니다. 보기만 하는 화면입니다 — 여기서 고치는 것은 없습니다."
      />

      <div className="container-page space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/staff"
            className="text-sm font-semibold text-ink-muted underline underline-offset-2"
          >
            ← 관리
          </Link>
        </div>

        {/* 개인정보 화면이라는 것을 늘 보이게 */}
        <p className="rounded-lg bg-subtle px-3 py-2 text-sm leading-relaxed text-ink-muted">
          🔒 <strong className="font-semibold">개인정보가 모두 보이는 화면입니다.</strong> 화면 공유·출력·캡처를
          조심해 주세요. 시트로 내보내지 않습니다. 테스트 계정 지정은 지금처럼 관리 도구로 합니다.
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm leading-relaxed text-status-revision"
          >
            {error}
          </p>
        )}
        {appsError && (
          <p role="alert" className="text-sm font-semibold text-status-revision">
            {appsError}
          </p>
        )}

        {/* 찾기 */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className="text-sm font-semibold">찾기</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 · 이메일 · 소속 · 학번 · 전화번호"
              className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600"
            />
          </label>
          <label>
            <span className="text-sm font-semibold">유형</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemberType | '')}
              className="mt-1.5 block rounded-xl border border-line-strong bg-surface p-3 text-base"
            >
              <option value="">전체</option>
              {(Object.keys(MEMBER_TYPE_LABEL) as MemberType[]).map((t) => (
                <option key={t} value={t}>
                  {MEMBER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-semibold">구분</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="mt-1.5 block rounded-xl border border-line-strong bg-surface p-3 text-base"
            >
              <option value="">전체</option>
              {(Object.keys(KIND_LABEL) as Exclude<Kind, ''>[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {members !== null && members.length > 0 && (
          <p className="text-sm text-ink-muted">
            전체 <strong className="font-semibold text-ink">{members.length}</strong>명 · 학생{' '}
            {typeCounts.student} · 교원 {typeCounts.teacher} · 일반 {typeCounts.general}
            {filtered && (
              <>
                {' '}
                → 찾은 결과 <strong className="font-semibold text-ink">{shown.length}</strong>명
              </>
            )}
          </p>
        )}

        {members === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <EmptyState
            title={filtered ? '찾는 회원이 없습니다' : '가입한 회원이 없습니다'}
            desc={filtered ? '찾는 말이나 거르기를 바꿔 보세요.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {shown.map((m) => (
              <MemberRow key={m.uid} member={m} apps={appsByUid.get(m.uid) ?? []} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** 한 줄 = 한 회원. 누르면 펼쳐져 가입 정보 · 동의 이력 · 신청 이력 */
function MemberRow({ member: m, apps }: { member: SupportUser; apps: Application[] }) {
  const k = kindOf(m)
  const type = memberTypeOf(m.memberType)
  const sub = [MEMBER_TYPE_LABEL[type], m.affiliation, m.major, identityLine(m)]
    .filter(Boolean)
    .join(' · ')
  const live = apps.filter((a) => a.status !== 'cancelled').length

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-start gap-x-3 gap-y-1 px-5 py-4 hover:bg-subtle">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{m.name || '(이름 없음)'}</span>
              {k === 'staff' && <Badge tone="info">담당자</Badge>}
              {k === 'tester' && <Badge tone="warn">테스트</Badge>}
              {k === 'withdrawn' && <Badge tone="voided">탈퇴</Badge>}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{sub}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-ink-subtle">
            <span>가입 {formatDate(m.createdAt)}</span>
            <span>
              신청 <strong className="font-semibold text-ink">{live}</strong>
              {apps.length > live && <> (취소 {apps.length - live})</>}
            </span>
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ▸
            </span>
          </div>
        </summary>

        <div className="space-y-5 border-t border-line bg-subtle/40 px-5 py-4 text-sm">
          {/* 가입 정보 — 신청서·PDF 와 같은 표(profileRows)를 쓴다 */}
          <section>
            <h3 className="font-bold">가입 정보</h3>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-[8rem_1fr]">
              {profileRows(m).map(([label, value]) => (
                <Row key={label} label={label} value={value} />
              ))}
              <Row label="가입 방식" value={PROVIDER_LABEL[m.authProvider] ?? m.authProvider} />
              <Row label="가입" value={formatDateTime(m.createdAt)} />
              {m.updatedAt &&
                m.createdAt &&
                m.updatedAt.toMillis() - m.createdAt.toMillis() > 60_000 && (
                  <Row label="정보 수정" value={formatDateTime(m.updatedAt)} />
                )}
            </dl>
          </section>

          <section>
            <h3 className="font-bold">동의 이력</h3>
            {(m.consents ?? []).length === 0 ? (
              <p className="mt-1.5 text-ink-subtle">기록이 없습니다.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {m.consents.map((c, i) => (
                  <li key={`${c.purpose}-${i}`}>
                    {CONSENT_LABEL[c.purpose] ?? c.purpose} —{' '}
                    <strong className="font-semibold">{c.agreed ? '동의' : '거부'}</strong>
                    <span className="text-ink-subtle">
                      {' '}
                      · 문구 {c.version} · {formatDateTime(c.agreedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-ink-subtle">
              초상권 동의는 가입이 아니라 신청서마다 받습니다 — 신청 목록의 그 신청서에서 보세요.
            </p>
          </section>

          <section>
            <h3 className="font-bold">신청 이력</h3>
            {apps.length === 0 ? (
              <p className="mt-1.5 text-ink-subtle">신청한 적이 없습니다.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {apps.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={APPLICATION_TONE[a.status]}>
                      {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                    <span className="font-medium">{a.programTitle || a.programId}</span>
                    <span className="text-xs text-ink-subtle">
                      제출 {formatDate(a.submittedAt)}
                      {(a.editCount ?? 0) > 0 && <> · 수정 {a.editCount}회</>}
                    </span>
                    {a.sheetSkipped === 'tester' && <Badge tone="warn">시험</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-ink-subtle">
              신청 내용·상태 변경은 <Link href="/staff" className="underline underline-offset-2">관리</Link>{' '}
              화면의 신청 목록에서 합니다.
            </p>
          </section>
        </div>
      </details>
    </li>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="break-all">{value || <span className="text-ink-subtle">—</span>}</dd>
    </>
  )
}
