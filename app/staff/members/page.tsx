'use client'

/**
 * 담당자 「회원 관리」 — 회원 정보 보기 (D-114 · 09-28) + 담당자 지정·회수 (D-120 · 10-02)
 *
 * 담당자가 "이 사람이 누구고 무엇을 냈나"를 콘솔 없이 보는 곳이다. 지금까지는 신청 목록의
 * 제출 시점 사본이나 Firebase 콘솔(개인정보가 통째로 열린다)밖에 없었다.
 *
 * **회원 정보는 고치지 않는다.** 회원 정보 수정 · 탈퇴 처리 · 테스트 계정 지정은 여기 없다 —
 * 테스트 계정 지정은 지금처럼 `scripts/grant-tester.mjs`(10-02 sunbell — 보류).
 *
 * 고치는 것은 **담당자 권한 하나**(D-120) — 회원을 펼친 맨 아래 「담당자 권한」. 브라우저가 회원
 * 문서를 직접 바꾸지 않고 서버(`/api/staff/role`)가 한다: 요청자 확인 · 자기 회수 막기 · 이메일
 * 인증된 계정만 · 사유 필수 · 기록(`support_role_changes`). 규칙도 그에 맞춰 담당자가 회원 문서를
 * 직접 고치던 길을 닫았다. 예전에는 `scripts/grant-staff.mjs` 를 돌릴 수 있는 사람(서비스 계정
 * 키가 있는 사람)만 담당자를 늘리거나 뺄 수 있었다.
 *
 * ⚠️ 나중에 여기에 「일반 ↔ 테스트」 스위치를 붙일 때: **신청이 있는 회원은 막아야 한다.**
 *    테스트 표시는 한 번 붙으면 떨어지지 않아(D-111 보강) 실수로 바꿨다 되돌려도 그 사이 상태를
 *    바꾼 신청은 시트에서 영영 빠진다. 담당자 권한처럼 서버가 바꾸게 할 것(규칙은 이미 막혀 있다).
 *
 * 시트로 내보내지 않는다. 내려받기도 없다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import { useTestView } from '@/components/staff/TestView'
import { APPLICATION_TONE } from '@/lib/ui/statusTone'
import { changeStaffRole, listMembers, listRoleChanges } from '@/lib/firebase/members'
import { listAllApplications } from '@/lib/firebase/staff'
import { formatDate, formatDateTime } from '@/lib/firebase/programs'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import {
  APPLICATION_STATUS_LABEL,
  MEMBER_TYPE_LABEL,
  ROLE_REASON_MAX,
  identityLine,
  memberTypeOf,
  profileRows,
  type Application,
  type ConsentPurpose,
  type MemberType,
  type RoleChange,
  type SupportRole,
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

// 저장값은 Firebase 의 providerId 그대로 — 구글은 'google.com'(10-02 전에는 'google' 로만 적어
// 화면에 「google.com」이 그대로 찍혔다)
const PROVIDER_LABEL: Record<string, string> = {
  'google.com': '구글 계정',
  google: '구글 계정',
  password: '이메일·비밀번호',
}

const ROLE_LABEL: Record<SupportRole, string> = {
  applicant: '일반 회원',
  staff: '담당자',
  tester: '테스트 계정',
}

export default function StaffMembersPage() {
  return (
    <MemberGate requireStaff>
      <StaffMembersContent />
    </MemberGate>
  )
}

function StaffMembersContent() {
  const { user } = useAuth()
  const [allMembers, setMembers] = useState<SupportUser[] | null>(null)
  // D-124: 「시험 데이터」 스위치가 꺼져 있으면 테스트 계정을 목록·회원 수에서 뺀다(회원 문서의 역할로 바로 안다)
  const { showTests } = useTestView()
  const members = useMemo(
    () => (allMembers === null ? null : showTests ? allMembers : allMembers.filter((m) => m.role !== 'tester')),
    [allMembers, showTests]
  )
  const [appsByUid, setAppsByUid] = useState<Map<string, Application[]>>(new Map())
  const [changes, setChanges] = useState<RoleChange[]>([])
  const [error, setError] = useState('')
  const [appsError, setAppsError] = useState('')
  const [changesError, setChangesError] = useState('')

  const [q, setQ] = useState('')
  const [type, setType] = useState<MemberType | ''>('')
  const [kind, setKind] = useState<Kind>('')
  // 「테스트 계정」 거르기를 고른 채 시험 데이터를 끄면 빈 목록이 남는다 — 「전체」로 되돌린다
  useEffect(() => {
    if (!showTests && kind === 'tester') setKind('')
  }, [showTests, kind])

  /** 회원 목록 + 담당자 변경 기록 — 처음과, 담당자를 지정·회수한 뒤에 다시 읽는다 */
  const loadMembers = useCallback(async () => {
    try {
      setMembers(await listMembers())
      setError('')
    } catch (e) {
      console.error('[iLINE] 회원 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setMembers((prev) => prev ?? [])
    }
    // 기록은 따로 — 실패해도(규칙 배포 전 등) 회원 목록은 보이게
    try {
      setChanges(await listRoleChanges())
      setChangesError('')
    } catch (e) {
      console.error('[iLINE] 담당자 변경 기록 조회 실패:', e)
      setChangesError('담당자 지정·회수 기록을 불러오지 못했습니다. 새로고침해 주세요.')
    }
  }, [])

  useEffect(() => {
    void loadMembers()
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
  }, [loadMembers])

  /** 이름 찾기 — 기록에는 uid 만 있다(회원 문서는 지우지 않으므로 늘 찾힌다) */
  const nameOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of allMembers ?? []) map.set(m.uid, m.name || m.email || '(이름 없음)')
    return map
  }, [allMembers])

  const changesByUid = useMemo(() => {
    const map = new Map<string, RoleChange[]>()
    for (const c of changes) {
      const list = map.get(c.uid) ?? []
      list.push(c)
      map.set(c.uid, list)
    }
    return map
  }, [changes])

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
  const staffCount = (members ?? []).filter((m) => m.role === 'staff' && m.status === 'active').length

  return (
    <>
      <PageHeader
        title="회원 관리"
        description="가입한 회원의 정보와 신청 이력을 봅니다. 회원 정보는 고치지 않습니다 — 고치는 것은 담당자 지정·회수 하나입니다."
      />

      <div className="container-page space-y-6 py-8">
        {/* 돌아가기 링크는 머리말 위 관리 메뉴 줄로 옮겼다 (10-02 · components/staff/StaffNav) */}
        {/* 개인정보 화면이라는 것을 늘 보이게 */}
        <p className="rounded-lg bg-subtle px-3 py-2 text-sm leading-relaxed text-ink-muted">
          🔒 <strong className="font-semibold">개인정보가 모두 보이는 화면입니다.</strong> 화면 공유·출력·캡처를
          조심해 주세요. 시트로 내보내지 않습니다. 담당자 지정·회수는 회원을 펼친 맨 아래 「담당자
          권한」에서 합니다. 테스트 계정 지정은 지금처럼 관리 도구로 합니다. 테스트 계정은 관리 줄 오른쪽의 「시험 데이터」를
          켜면 보입니다.
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
        {changesError && (
          <p role="alert" className="text-sm font-semibold text-status-revision">
            {changesError}
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
              {(Object.keys(KIND_LABEL) as Exclude<Kind, ''>[])
                .filter((k) => showTests || k !== 'tester')
                .map((k) => (
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
            {typeCounts.student} · 교원 {typeCounts.teacher} · 일반 {typeCounts.general} · 담당자{' '}
            {staffCount}
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
              <MemberRow
                key={m.uid}
                member={m}
                apps={appsByUid.get(m.uid) ?? []}
                changes={changesByUid.get(m.uid) ?? []}
                nameOf={nameOf}
                isMe={m.uid === user?.uid}
                onRoleChanged={loadMembers}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** 한 줄 = 한 회원. 누르면 펼쳐져 가입 정보 · 동의 이력 · 신청 이력 · 담당자 권한 */
function MemberRow({
  member: m,
  apps,
  changes,
  nameOf,
  isMe,
  onRoleChanged,
}: {
  member: SupportUser
  apps: Application[]
  changes: RoleChange[]
  nameOf: Map<string, string>
  isMe: boolean
  onRoleChanged: () => Promise<void>
}) {
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
              신청 내용·상태 변경은{' '}
              <Link href="/staff" className="underline underline-offset-2">
                신청 관리
              </Link>
              에서 합니다.
            </p>
          </section>

          <StaffRoleSection
            member={m}
            changes={changes}
            nameOf={nameOf}
            isMe={isMe}
            onChanged={onRoleChanged}
          />
        </div>
      </details>
    </li>
  )
}

/**
 * 「담당자 권한」 — 지정 · 회수 · 변경 기록 (D-120 · 10-02)
 *
 * 버튼을 누르면 바로 바꾸지 않고 확인 칸을 연다: 무엇이 달라지는지 + 사유(필수).
 * 막는 것(자기 회수 · 인증 안 된 계정 · 테스트 계정 · 탈퇴)은 **서버가 다시 확인**한다 —
 * 화면이 버튼을 감추는 것은 헛걸음을 줄이려는 것뿐이다.
 *
 * 실패하면 확인 칸을 닫지 않는다 — 「역할은 바꿨지만 첨부 권한은 못 바꿈」일 때 같은 버튼을
 * 한 번 더 누르면 서버가 나머지를 맞춘다(새로 읽으면 버튼이 반대로 바뀌어 다시 누를 수 없다).
 */
function StaffRoleSection({
  member: m,
  changes,
  nameOf,
  isMe,
  onChanged,
}: {
  member: SupportUser
  changes: RoleChange[]
  nameOf: Map<string, string>
  isMe: boolean
  onChanged: () => Promise<void>
}) {
  const [action, setAction] = useState<'grant' | 'revoke' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<'grant' | 'revoke' | null>(null)

  const role: SupportRole = m.role ?? 'applicant'
  const canGrant = role === 'applicant' && m.status === 'active'
  const canRevoke = role === 'staff' && !isMe

  const open = (a: 'grant' | 'revoke') => {
    setAction(a)
    setReason('')
    setError('')
    setDone(null)
  }

  const submit = async () => {
    if (!action || !reason.trim()) return
    setBusy(true)
    setError('')
    try {
      await changeStaffRole(m.uid, action, reason.trim())
      setDone(action)
      setAction(null)
      setReason('')
      await onChanged()
    } catch (e) {
      setError(actionErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h3 className="font-bold">담당자 권한</h3>
      <p className="mt-1.5">
        지금: <strong className="font-semibold">{ROLE_LABEL[role] ?? role}</strong>
        {m.status === 'withdrawn' && <span className="text-ink-subtle"> · 탈퇴</span>}
        {isMe && <span className="text-ink-subtle"> · 나</span>}
      </p>

      {done === 'grant' && (
        <div role="status" className="mt-2 rounded-lg bg-accent-soft px-3 py-2 leading-relaxed text-accent-ink">
          <p className="font-semibold">담당자로 지정했습니다.</p>
          <p className="mt-1">
            그 사람이 사이트를 <strong>새로고침</strong>하면 「관리」 메뉴가 보이고 첨부 파일도 열립니다(다시
            로그인하지 않아도 됩니다).
          </p>
          <p className="mt-1">
            ☐ 시트·드라이브도 봐야 하는 사람이면 <strong>구글 시트 「공유」와 공유 드라이브 「멤버 관리」</strong>에
            그 사람의 구글 계정을 직접 초대해 주세요 — 사이트는 시트·드라이브에 사람을 넣거나 빼지 않습니다.
          </p>
        </div>
      )}
      {done === 'revoke' && (
        <div role="status" className="mt-2 rounded-lg bg-warn-soft px-3 py-2 leading-relaxed text-warn-ink">
          <p className="font-semibold">담당자 권한을 회수했습니다.</p>
          <p className="mt-1">
            🔴 그 사람을 구글 시트·공유 드라이브에 초대했었다면{' '}
            <strong>시트 「공유」와 공유 드라이브 「멤버 관리」에서도 직접 빼 주세요.</strong> 사이트는
            시트·드라이브에 사람을 넣거나 빼지 않습니다 — 초대가 남아 있으면 시트로 신청자 개인정보를 계속 봅니다.
          </p>
          <p className="mt-1">
            그 사람이 열어 둔 화면에서는 첨부 파일이 최대 1시간 더 열릴 수 있습니다(로그인 표시가 바뀌는
            시간).
          </p>
        </div>
      )}

      {action === null ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canGrant && (
            <Button variant="secondary" onClick={() => open('grant')}>
              담당자로 지정
            </Button>
          )}
          {canRevoke && (
            <Button variant="danger" onClick={() => open('revoke')}>
              담당자 권한 회수
            </Button>
          )}
          {role === 'staff' && isMe && (
            <p className="text-xs text-ink-subtle">
              본인의 담당자 권한은 회수할 수 없습니다 — 다른 담당자가 합니다(담당자가 아무도 없게 되는 일을 막기
              위해).
            </p>
          )}
          {role === 'tester' && (
            <p className="text-xs text-ink-subtle">
              테스트 계정은 담당자로 지정할 수 없습니다. 테스트 계정 지정·해제는 관리 도구로 합니다.
            </p>
          )}
          {role === 'applicant' && m.status === 'withdrawn' && (
            <p className="text-xs text-ink-subtle">탈퇴한 회원은 담당자로 지정할 수 없습니다.</p>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-3 rounded-xl border border-line-strong bg-surface p-4">
          {action === 'grant' ? (
            <p className="leading-relaxed">
              <strong className="font-semibold">{m.name || m.email}</strong> 님을 담당자로 지정하면{' '}
              <strong>모든 신청자의 개인정보</strong>(회원 정보 · 신청서 · 첨부 · 정산 서류)를 보고, 신청 상태를
              바꾸고, 다른 사람을 담당자로 지정할 수 있게 됩니다.
              {m.authProvider === 'password' && (
                <span className="text-ink-muted">
                  {' '}
                  이메일·비밀번호로 가입한 계정이면 <strong>이메일 인증</strong>이 되어 있어야 합니다.
                </span>
              )}
            </p>
          ) : (
            <p className="leading-relaxed">
              <strong className="font-semibold">{m.name || m.email}</strong> 님의 「관리」 화면과 첨부 파일 열람이
              닫히고 일반 회원이 됩니다. 그 사람이 낸 신청·처리 기록은 그대로 남습니다.
            </p>
          )}

          <label className="block">
            <span className="text-sm font-semibold">사유 (필수 · 기록에 남습니다)</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={ROLE_REASON_MAX}
              disabled={busy}
              placeholder={action === 'grant' ? '예: 10월부터 정산 담당 합류' : '예: 담당 업무 끝남(10월)'}
              className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600 disabled:opacity-60"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-semibold text-status-revision">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant={action === 'grant' ? 'primary' : 'danger'}
              onClick={submit}
              disabled={busy || !reason.trim()}
            >
              {busy ? '처리 중…' : action === 'grant' ? '담당자로 지정' : '권한 회수'}
            </Button>
            <Button variant="secondary" onClick={() => setAction(null)} disabled={busy}>
              취소
            </Button>
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink-muted">변경 기록</p>
          <ul className="mt-1 space-y-1">
            {changes.map((c) => (
              <li key={c.id} className="text-xs leading-relaxed">
                <span className="text-ink-subtle">{formatDateTime(c.at)}</span> ·{' '}
                {ROLE_LABEL[c.from] ?? c.from} → <strong className="font-semibold">{ROLE_LABEL[c.to] ?? c.to}</strong>{' '}
                · {c.via === 'script' || !c.by ? '관리 도구' : nameOf.get(c.by) ?? '(알 수 없는 담당자)'}
                {c.reason && <> · 「{c.reason}」</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
