// 담당자 기능 (W3 · D-10)
//
// 백오피스를 만들지 않기로 했으므로(D-7), 담당자에게 필요한 것은
// **상태를 바꾸는 화면 한 장**뿐이다. 목록 열람과 통계는 구글 시트가 맡는다.
//
// ⚠️ 담당자 판별은 Firestore 의 support_users/{uid}.role === 'staff' 이다.
//    Storage 규칙은 Firestore 를 읽을 수 없어서 Custom Claims 를 쓴다.
//    둘은 별개이므로, 신청자의 첨부 파일까지 열어보려면 Claims 도 부여해야 한다.
//    (docs/08-staff-setup.md 참고)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import { applicationKeyId } from './applications'
import type { Application, ApplicationStatus, Program } from '@/lib/types'

/**
 * 전체 신청 목록.
 *
 * 프로그램 필터는 Firestore 에 맡기고(단일 조건이라 색인이 필요 없다),
 * 상태 필터와 정렬은 화면에서 한다. 조건을 겹쳐 쓰면 복합 색인을 요구받는다.
 */
export async function listAllApplications(
  programId?: string
): Promise<Application[]> {
  const base = collection(getDb(), COL.applications)
  const q = programId ? query(base, where('programId', '==', programId)) : base

  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Application)
    .sort(
      (a, b) =>
        (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0)
    )
}

/**
 * 상태 변경 (D-10).
 *
 * `reviewNote` 는 신청자에게 그대로 보인다(마이페이지). 보완 요청 사유나
 * 미선정 사유가 여기 들어가므로, 담당자가 쓴 문장이 곧 통지문이다.
 */
export async function updateApplicationStatus(
  appId: string,
  status: ApplicationStatus,
  reviewNote: string,
  reviewerUid: string
): Promise<void> {
  await updateDoc(doc(getDb(), COL.applications, appId), {
    status,
    // 빈 문자열로 덮어써야 이전 사유가 남지 않는다
    reviewNote: reviewNote.trim(),
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * 신청 취소 (W-2).
 *
 * **문서를 지우지 않는다.** 상태만 `cancelled` 로 바꾸고, 대신 중복 신청을
 * 막고 있던 **열쇠 문서를 지운다.** 그래야 같은 사람이 다시 신청할 수 있다.
 *
 * 두 곳이 서로 다른 지점에서 막기 때문에 한쪽만 풀면 되돌아가지 않는다.
 *   · 신청서 문서 → 화면(findMyApplication)이 신청 폼을 안 열어준다
 *   · 열쇠 문서   → 보안 규칙이 제출을 거부한다
 * 그래서 **한 묶음(batch)으로** 처리한다. 하나만 성공하면 어중간한 상태가 된다.
 *
 * 기록을 남기는 이유: 지워버리면 "신청했던 사실"까지 사라져서, 나중에
 * "왜 이 사람 신청이 없느냐"를 확인할 수 없다.
 */
export async function cancelApplication(
  app: Application,
  reason: string,
  reviewerUid: string
): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)

  batch.update(doc(db, COL.applications, app.id), {
    status: 'cancelled',
    reviewNote: reason.trim(),
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  batch.delete(
    doc(db, COL.applicationKeys, applicationKeyId(app.uid, app.programId))
  )

  await batch.commit()
}

/* ── 프로그램(공고) 관리 — D-37 ────────────────────────────────────── */

/**
 * 비공개까지 포함한 전체 프로그램 목록.
 *
 * `listPublishedPrograms()` 와 달리 `published` 조건을 걸지 않는다.
 * 규칙이 `published == true || isStaff()` 라서 담당자만 전부 읽힌다.
 */
export async function listAllPrograms(): Promise<Program[]> {
  const snap = await getDocs(collection(getDb(), COL.programs))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Program)
    .sort((a, b) => {
      if (a.year !== b.year) return (b.year ?? 0) - (a.year ?? 0)
      return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
    })
}

/** 이미 쓰고 있는 문서 ID 인가 — 새 프로그램을 만들기 전에 확인한다 */
export async function programIdTaken(id: string): Promise<boolean> {
  return (await getDoc(doc(getDb(), COL.programs, id))).exists()
}

/** 화면에서 넘어오는 값 — 비어 있으면 아예 저장하지 않는다 */
export interface ProgramInput {
  title: string
  year: number
  participationType: Program['participationType']
  maxTeamSize?: number
  description?: string
  opensAt?: Date
  closesAt?: Date
  noteLabel?: string
  noteRequired?: boolean
  attachmentGuide?: string
  attachmentRequired?: boolean
  published: boolean
}

/**
 * 빈 값을 걸러 낸 저장용 객체.
 *
 * `noteLabel: ''` 같은 빈 문자열을 그대로 저장하면 화면이 "칸이 있다"고
 * 판단해 이름 없는 입력칸이 생긴다. **없는 것과 빈 것은 다르다.**
 */
function toDoc(input: ProgramInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: input.title.trim(),
    year: input.year,
    participationType: input.participationType,
    published: input.published,
    updatedAt: serverTimestamp(),
  }

  const put = (k: string, v: unknown) => {
    if (v !== undefined && v !== '' && v !== null) out[k] = v
  }

  put('description', input.description?.trim())
  put('opensAt', input.opensAt)
  put('closesAt', input.closesAt)
  put('noteLabel', input.noteLabel?.trim())
  put('attachmentGuide', input.attachmentGuide?.trim())

  // 단체 프로그램이 아니면 인원 제한은 의미가 없다
  if (input.participationType === 'group') put('maxTeamSize', input.maxTeamSize)

  // 필수 여부는 그 칸이 있을 때만 뜻이 있다
  if (input.noteLabel?.trim()) out.noteRequired = Boolean(input.noteRequired)
  if (input.attachmentGuide?.trim()) {
    out.attachmentRequired = Boolean(input.attachmentRequired)
  }

  return out
}

/** 새 프로그램 — 문서 ID 는 담당자가 직접 정한다(주소에 노출되므로) */
export async function createProgram(
  id: string,
  input: ProgramInput
): Promise<void> {
  await setDoc(doc(getDb(), COL.programs, id), {
    ...toDoc(input),
    createdAt: serverTimestamp(),
  })
}

/**
 * 프로그램 수정.
 *
 * ⚠️ `setDoc` 으로 통째로 덮어쓴다. `updateDoc` 을 쓰면 화면에서 비운 값
 *    (예: 첨부 안내를 지운 경우)이 문서에 그대로 남아, 지운 칸이 계속 보인다.
 *    `createdAt` 은 화면에서 넘어오지 않으므로 여기서 살려서 넣는다.
 */
export async function updateProgram(
  id: string,
  input: ProgramInput,
  createdAt?: Program['createdAt']
): Promise<void> {
  await setDoc(doc(getDb(), COL.programs, id), {
    ...toDoc(input),
    // 콘솔에서 손으로 만든 프로그램은 createdAt 이 없을 수 있다.
    // 그럴 때 undefined 를 넣으면 저장이 거부되므로 지금 시각으로 채운다.
    createdAt: createdAt ?? serverTimestamp(),
  })
}

/**
 * 시트 동기화 재시도 (담당자용).
 *
 * 연동 설정을 고친 뒤 이미 들어온 신청 건을 다시 올릴 때 쓴다.
 * 이게 없으면 설정을 고칠 때마다 신청서를 새로 제출해야 한다.
 *
 * 서버가 다시 요청자를 검증하므로, 이 함수를 부를 수 있다는 것만으로
 * 권한이 생기지는 않는다.
 */
export async function retrySync(applicationId: string): Promise<void> {
  const { getAuthClient } = await import('./config')
  const token = await getAuthClient().currentUser?.getIdToken()
  if (!token) throw new Error('로그인 정보를 확인할 수 없습니다.')

  const res = await fetch('/api/sync/application', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ applicationId }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '동기화에 실패했습니다.')
  if (data.skipped === 'not-configured') {
    throw new Error('서버에 구글 연동 설정이 없습니다. 환경변수를 확인해 주세요.')
  }
}
