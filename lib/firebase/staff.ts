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
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import type { Application, ApplicationStatus } from '@/lib/types'

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
