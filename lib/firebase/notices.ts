// 공지사항 (support_notices) — 알림마당
//
// 누구나 읽고, 담당자만 쓴다. 보안 규칙에 그대로 반영되어 있다.
//
// 본문은 **서식 없는 여러 줄 글**이다. 편집기를 붙이지 않은 이유:
//  · 공고 안내는 대부분 몇 문단짜리 글이라 굵게·표가 필요 없다
//  · 편집기를 붙이면 붙여넣기로 들어온 HTML을 걸러야 하고(XSS),
//    그 검증을 감당할 만큼의 이득이 없다
// 줄바꿈은 화면에서 `whitespace-pre-line` 으로 그대로 살린다.
//
// 첨부 파일 (D-112 · 09-27) — 공개 경로 `support/public/notices/{공지 번호}/`.
//  · storage.rules 가 「읽기 누구나 · 쓰기 담당자 · 형식 표 안 · 20MB 미만」으로 막는다.
//    화면의 검사(noticeFileRejectReason)와 **같은 기준**이라, 화면을 거치지 않고 올려도 똑같이 막힌다
//  · 🔴 **로그인 안 한 사람도 받는다.** 개인정보가 담긴 파일은 올리면 안 된다(화면에 늘 경고)
//  · 공지를 지우거나 파일을 빼면 **Storage 의 파일도 지운다.** 안 지우면 공지가 사라진 뒤에도
//    주소를 아는 사람은 계속 받는다
//  · 문서에는 **주소를 저장하지 않고 경로만** 둔다. 보는 화면이 그때 주소를 받는다 — 나중에
//    「회원만 받기」로 바꾸게 되면 경로·규칙만 바꾸면 된다(주소를 저장하면 그 주소는 규칙과
//    상관없이 영원히 열린다)

import {
  collection,
  doc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, deleteObject, getDownloadURL, listAll } from 'firebase/storage'
import { getDb, getStorageClient, COL, STORAGE_ROOT } from './config'
import { OUTPUT_FILE_TYPES } from './outputs'
import type { AttachedFile, Notice } from '@/lib/types'

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

/* ── 첨부 파일 ────────────────────────────────────────────────── */

/**
 * 받는 형식 — 산출물 표(`OUTPUT_FILE_TYPES`)에서 **영상만 뺐다.** 공지 첨부는 공고문·서식·포스터라
 * 영상이 필요 없고, 20MB 안에 들지도 않는다. storage.rules 의 `isOutputType()` 목록 안에 있다
 */
export const NOTICE_FILE_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(OUTPUT_FILE_TYPES).filter(([, type]) => !type.startsWith('video/'))
)
/** storage.rules `isUnderSizeLimit()` 와 같은 값 — 규칙이 「미만」이라 여기도 「미만」 */
export const NOTICE_MAX_BYTES = 20 * 1024 * 1024
export const NOTICE_MAX_FILES = 10
/** 파일 고르기 창에 넘길 확장자 목록 */
export const NOTICE_ACCEPT = Object.keys(NOTICE_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')

const NOTICE_DIR = `${STORAGE_ROOT}/public/notices`

function noticeFileType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return NOTICE_FILE_TYPES[ext] ?? null
}

/** 붙일 수 없는 이유 — 없으면 null. `picked` 는 이미 붙어 있는 개수 */
export function noticeFileRejectReason(file: File, picked: number): string | null {
  if (!noticeFileType(file)) return '받지 않는 형식입니다 (PDF·한글·워드·엑셀·파워포인트·사진·압축만)'
  if (file.size >= NOTICE_MAX_BYTES) {
    return `20MB보다 작아야 합니다 (${(file.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (picked >= NOTICE_MAX_FILES) return `파일은 공지 하나에 최대 ${NOTICE_MAX_FILES}개까지입니다`
  return null
}

/** 1.2MB · 340KB — 받는 사람이 크기를 보고 고르게 */
export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

/** 받을 주소 — 공개 경로라 로그인 없이도 나온다 */
export async function noticeFileUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(getStorageClient(), storagePath))
}

async function uploadNoticeFile(noticeId: string, file: File): Promise<AttachedFile> {
  const type = noticeFileType(file)
  if (!type) throw new Error(`받지 않는 형식: ${file.name}`)
  // 경로는 다른 첨부와 같은 방식(시각_정리한 이름). 받을 때 이름은 contentDisposition 으로
  // **원래 이름**을 준다 — 안 주면 `1727…_공고문.hwp` 처럼 숫자가 붙어 내려받아진다
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_')
  const path = `${NOTICE_DIR}/${noticeId}/${Date.now()}_${safeName}`
  const encoded = encodeURIComponent(file.name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
  await uploadBytes(ref(getStorageClient(), path), file, {
    contentType: type,
    contentDisposition: `inline; filename*=UTF-8''${encoded}`,
  })
  return {
    type: 'notice',
    storagePath: path,
    fileName: file.name,
    size: file.size,
    // 배열 안에는 serverTimestamp() 를 못 넣는다 (Firestore 제약)
    uploadedAt: Timestamp.now(),
  }
}

/** 지우기 — 실패해도 멈추지 않는다(공지 저장·삭제는 이미 끝난 뒤). 로그만 남긴다 */
async function removeFiles(files: AttachedFile[]): Promise<void> {
  await Promise.all(
    files.map((f) =>
      deleteObject(ref(getStorageClient(), f.storagePath)).catch((e) =>
        console.warn('[iLINE] 공지 첨부 삭제 실패(무시):', f.storagePath, e)
      )
    )
  )
}

/**
 * 새 파일을 차례로 올린다. **하나라도 실패하면 이번에 올린 것을 지우고** 오류를 던진다 —
 * 공지에 안 붙은 파일이 공개 경로에 남지 않게.
 */
async function uploadAll(
  noticeId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<AttachedFile[]> {
  const added: AttachedFile[] = []
  try {
    for (const f of files) {
      onProgress?.(added.length, files.length)
      added.push(await uploadNoticeFile(noticeId, f))
    }
    return added
  } catch (e) {
    await removeFiles(added)
    throw e
  }
}

/* ── 쓰기 ─────────────────────────────────────────────────────── */

/**
 * 새 공지 — 문서 ID는 자동. 주소에 노출되지만 공지는 검색으로 찾지 않는다.
 * 파일 경로에 공지 번호가 들어가서 **번호를 먼저 받고 → 파일 → 문서** 순서로 쓴다.
 */
export async function createNotice(
  input: NoticeInput,
  newFiles: File[],
  authorUid: string,
  onProgress?: (done: number, total: number) => void
): Promise<string> {
  const noticeRef = doc(collection(getDb(), COL.notices))
  const added = await uploadAll(noticeRef.id, newFiles, onProgress)
  const now = serverTimestamp()
  try {
    await setDoc(noticeRef, {
      title: input.title.trim(),
      content: input.content.trim(),
      pinned: input.pinned,
      // 없으면 키를 안 만든다 — 빈 배열이 남으면 화면이 "첨부가 있는데 비었다"로 오해한다
      ...(added.length > 0 ? { files: added } : {}),
      authorUid,
      createdAt: now,
      updatedAt: now,
    })
  } catch (e) {
    await removeFiles(added)
    throw e
  }
  return noticeRef.id
}

/**
 * 공지 수정.
 *
 * `createdAt` 은 건드리지 않는다 — 목록 순서가 바뀌면
 * "왜 예전 공지가 갑자기 맨 위로 올라왔지"가 된다.
 *
 * 파일은 **새 파일 올리기 → 문서 저장 → 뺀 파일 지우기** 순서. 문서 저장이 실패하면 옛 파일은
 * 그대로 붙어 있어야 하므로 지우기를 맨 뒤에 둔다.
 */
export async function updateNotice(
  prev: Notice,
  input: NoticeInput,
  files: { keep: AttachedFile[]; add: File[] },
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const added = await uploadAll(prev.id, files.add, onProgress)
  const next = [...files.keep, ...added]
  try {
    await updateDoc(doc(getDb(), COL.notices, prev.id), {
      title: input.title.trim(),
      content: input.content.trim(),
      pinned: input.pinned,
      files: next.length > 0 ? next : deleteField(),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    await removeFiles(added)
    throw e
  }
  const kept = new Set(files.keep.map((f) => f.storagePath))
  await removeFiles((prev.files ?? []).filter((f) => !kept.has(f.storagePath)))
}

/**
 * 공지 삭제.
 *
 * 공지는 신청서와 달리 다른 자료가 참조하지 않으므로 지워도 고아가 생기지 않는다.
 * 다만 **되돌릴 수 없으므로** 화면에서 한 번 더 확인을 받는다.
 *
 * 첨부는 문서가 기억하는 것만이 아니라 **그 공지 폴더를 통째로** 비운다 — 저장이 중간에 실패해
 * 남은 파일까지 함께 치운다. 폴더 비우기가 실패해도 공지는 이미 지워졌으므로 로그만 남긴다.
 */
export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL.notices, id))
  try {
    const { items } = await listAll(ref(getStorageClient(), `${NOTICE_DIR}/${id}`))
    await Promise.all(
      items.map((item) =>
        deleteObject(item).catch((e) =>
          console.warn('[iLINE] 공지 첨부 삭제 실패(무시):', item.fullPath, e)
        )
      )
    )
  } catch (e) {
    console.warn('[iLINE] 공지 첨부 폴더 비우기 실패(무시):', e)
  }
}
