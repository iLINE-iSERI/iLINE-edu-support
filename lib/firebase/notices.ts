// 공지사항 (support_notices) — 알림마당
//
// 누구나 읽고, 담당자만 쓴다. 보안 규칙에 그대로 반영되어 있다.
//
// 본문은 **서식 없는 여러 줄 글**이다. 편집기를 붙이지 않은 이유:
//  · 공고 안내는 대부분 몇 문단짜리 글이라 굵게·표가 필요 없다
//  · 편집기를 붙이면 붙여넣기로 들어온 HTML을 걸러야 하고(XSS),
//    그 검증을 감당할 만큼의 이득이 없다
// 줄바꿈은 화면에서 `whitespace-pre-line` 으로 그대로 살린다.

import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import type { Notice } from '@/lib/types'

/**
 * 공지 목록 — **고정 공지가 위**, 그다음 최신순.
 *
 * 정렬을 Firestore에 맡기지 않는다. `orderBy('pinned').orderBy('createdAt')` 는
 * 복합 색인을 요구하고, 색인을 만들기 전까지 목록이 통째로 실패한다.
 * 공지는 많아야 수십 건이라 여기서 정렬해도 충분하다.
 */
export async function listNotices(): Promise<Notice[]> {
  const snap = await getDocs(collection(getDb(), COL.notices))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Notice)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
    })
}

export async function getNotice(id: string): Promise<Notice | null> {
  const snap = await getDoc(doc(getDb(), COL.notices, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Notice
}

export interface NoticeInput {
  title: string
  content: string
  pinned: boolean
}

/** 새 공지 — 문서 ID는 자동. 주소에 노출되지만 공지는 검색으로 찾지 않는다 */
export async function createNotice(
  input: NoticeInput,
  authorUid: string
): Promise<string> {
  const ref = doc(collection(getDb(), COL.notices))
  const now = serverTimestamp()
  await setDoc(ref, {
    title: input.title.trim(),
    content: input.content.trim(),
    pinned: input.pinned,
    authorUid,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

/**
 * 공지 수정.
 *
 * `createdAt` 은 건드리지 않는다 — 목록 순서가 바뀌면
 * "왜 예전 공지가 갑자기 맨 위로 올라왔지"가 된다.
 */
export async function updateNotice(
  id: string,
  input: NoticeInput
): Promise<void> {
  await updateDoc(doc(getDb(), COL.notices, id), {
    title: input.title.trim(),
    content: input.content.trim(),
    pinned: input.pinned,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 공지 삭제.
 *
 * 공지는 신청서와 달리 다른 자료가 참조하지 않으므로 지워도 고아가 생기지 않는다.
 * 다만 **되돌릴 수 없으므로** 화면에서 한 번 더 확인을 받는다.
 */
export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL.notices, id))
}
