// 공지사항 (support_notices) — 알림마당
//
// 담당자만 쓴다. 누가 읽는지는 글마다 고른 **공개 범위**(D-113)가 정한다 — 보안 규칙에 그대로 있다.
//
// 본문은 **서식 없는 여러 줄 글**이다. 편집기를 붙이지 않은 이유:
//  · 공고 안내는 대부분 몇 문단짜리 글이라 굵게·표가 필요 없다
//  · 편집기를 붙이면 붙여넣기로 들어온 HTML을 걸러야 하고(XSS),
//    그 검증을 감당할 만큼의 이득이 없다
// 줄바꿈은 화면에서 `whitespace-pre-line` 으로 그대로 살린다.
//
// ── 겉장과 속지 (D-113 · 09-27) ────────────────────────────────────
//  · 겉장 `support_notices/{id}` — 제목·고정·공개 범위·첨부 수. 비공개만 빼고 **누구나** 읽는다
//  · 속지 `support_notices/{id}/body/main` — 본문·첨부 목록. 전체 공개면 누구나, 회원만이면 회원,
//    비공개면 담당자. 「회원만」 글의 **제목은 누구나 보고 본문은 회원만** 보게 하려면 문서를 나눌 수밖에
//    없다(규칙은 문서 단위라 칸을 골라 막지 못한다)
//  · 공개 범위를 바꿔도 **겉장의 값 하나만** 바뀐다. 속지·파일은 그대로다
//  · D-113 이전 공지는 본문이 겉장에 있다(`content` · `files`). 읽을 때는 그걸 쓰고, 담당자가 한 번
//    고쳐 저장하면 속지로 옮겨진다
//
// ── 첨부 파일 (D-112 → D-113) ──────────────────────────────────────
//  · **비공개 폴더** `support/notices/{공지 번호}/` 에 둔다. 브라우저는 직접 못 읽는다.
//    받을 주소는 서버(`/api/notices/files`)가 공개 범위와 회원 여부를 확인하고 **한 시간짜리**로 내준다.
//    그래서 공개 범위를 바꿔도 **파일을 옮기지 않는다**
//  · storage.rules 가 「쓰기 담당자 · 형식 표 안 · 50MB 미만」으로 막는다. 화면의 검사
//    (noticeFileRejectReason)와 **같은 기준**이라, 화면을 거치지 않고 올려도 똑같이 막힌다
//  · 공지를 지우거나 파일을 빼면 **Storage 의 파일도 지운다**
//  · D-112 때(09-27 하루) 올린 파일은 공개 폴더 `support/public/notices/` 에 남아 있을 수 있다 —
//    서버가 똑같이 주소를 내주고, 공지를 지울 때 그 폴더도 비운다

import {
  collection,
  doc,
  deleteField,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, deleteObject, listAll } from 'firebase/storage'
import { getDb, getStorageClient, getAuthClient, COL, STORAGE_ROOT } from './config'
import { firebaseErrorKind } from './errors'
import { OUTPUT_FILE_TYPES } from './outputs'
import type { AttachedFile, Notice, NoticeBody, NoticeVisibility } from '@/lib/types'

/* ── 읽기 ─────────────────────────────────────────────────────── */

/** 속지 문서 — 공지마다 하나, 이름은 늘 main */
function bodyRef(noticeId: string) {
  return doc(getDb(), COL.notices, noticeId, 'body', 'main')
}

/**
 * 공지 목록 — **고정 공지가 위**, 그다음 최신순.
 *
 * 담당자(`staff: true`)는 비공개까지 전부. 그 밖에는 **전체 공개·회원만** 만 묻는다 — 규칙이
 * 「비공개가 섞일 수 있는 목록 요청」을 통째로 거절하므로, 요청 자체에 조건을 걸어야 한다.
 *
 * 정렬을 Firestore에 맡기지 않는다. `orderBy('pinned').orderBy('createdAt')` 는
 * 복합 색인을 요구하고, 색인을 만들기 전까지 목록이 통째로 실패한다.
 * 공지는 많아야 수십 건이라 여기서 정렬해도 충분하다.
 */
export async function listNotices(opts: { staff?: boolean } = {}): Promise<Notice[]> {
  const col = collection(getDb(), COL.notices)
  const snap = await getDocs(
    opts.staff ? col : query(col, where('visibility', 'in', ['public', 'members']))
  )
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

export function visibilityOf(n: Pick<Notice, 'visibility'>): NoticeVisibility {
  return n.visibility ?? 'public'
}

/**
 * 속지(본문·첨부 목록). 읽을 자격이 없으면 `'locked'`.
 *
 * 속지가 없으면 D-113 이전 공지다 — 겉장의 본문을 쓴다. 속지 규칙이 배포되기 전에도
 * (거절돼도) 겉장에 본문이 있으면 그걸 쓴다 — 배포 순서 때문에 옛 공지가 안 보이는 일이 없게.
 */
export async function getNoticeBody(n: Notice): Promise<NoticeBody | 'locked'> {
  const legacy: NoticeBody | null =
    n.content !== undefined ? { content: n.content, ...(n.files ? { files: n.files } : {}) } : null
  try {
    const snap = await getDoc(bodyRef(n.id))
    if (snap.exists()) return snap.data() as NoticeBody
    return legacy ?? { content: '' }
  } catch (e) {
    if (firebaseErrorKind(e) !== 'permission-denied') throw e
    return legacy ?? 'locked'
  }
}

/** 받을 수 있는 첨부 — 서버가 내준 한 시간짜리 주소 */
export interface NoticeFileLink {
  storagePath: string
  fileName: string
  size: number
  url: string
}

/**
 * 첨부 주소 받기 — 로그인했으면 ID 토큰을 함께 보낸다(회원만·비공개 확인용).
 * 자격이 없으면 `'locked'`.
 */
export async function noticeFileLinks(noticeId: string): Promise<NoticeFileLink[] | 'locked'> {
  const token = await getAuthClient()
    .currentUser?.getIdToken()
    .catch(() => undefined)
  const res = await fetch('/api/notices/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ noticeId }),
  })
  if (res.status === 403) return 'locked'
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return ((await res.json()).files ?? []) as NoticeFileLink[]
}

export interface NoticeInput {
  title: string
  content: string
  pinned: boolean
  visibility: NoticeVisibility
}

/* ── 첨부 파일 ────────────────────────────────────────────────── */

/**
 * 받는 형식 — 산출물 표(`OUTPUT_FILE_TYPES`)에서 **영상만 뺐다.** 공지 첨부는 공고문·서식·포스터라
 * 영상이 필요 없다. storage.rules 의 `isOutputType()` 목록 안에 있다
 */
export const NOTICE_FILE_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(OUTPUT_FILE_TYPES).filter(([, type]) => !type.startsWith('video/'))
)
/**
 * storage.rules `support/notices/` 의 크기와 같은 값 — 규칙이 「미만」이라 여기도 「미만」.
 * 09-27 iSERI 결정: 20MB → **50MB**(산출물 제출과 같다). 없애지 않은 이유는 D-113 ⑥ —
 * 받아 간 양만큼 요금이 나오는데, 제한이 파일 하나가 만들 수 있는 최악을 묶는다
 */
export const NOTICE_MAX_BYTES = 50 * 1024 * 1024
export const NOTICE_MAX_FILES = 10
/** 파일 고르기 창에 넘길 확장자 목록 */
export const NOTICE_ACCEPT = Object.keys(NOTICE_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')

const NOTICE_DIR = `${STORAGE_ROOT}/notices`
/** D-112 때의 공개 폴더 — 지울 때만 쓴다 */
const LEGACY_NOTICE_DIR = `${STORAGE_ROOT}/public/notices`

function noticeFileType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return NOTICE_FILE_TYPES[ext] ?? null
}

/** 붙일 수 없는 이유 — 없으면 null. `picked` 는 이미 붙어 있는 개수 */
export function noticeFileRejectReason(file: File, picked: number): string | null {
  if (!noticeFileType(file)) return '받지 않는 형식입니다 (PDF·한글·워드·엑셀·파워포인트·사진·압축만)'
  if (file.size >= NOTICE_MAX_BYTES) {
    return `50MB보다 작아야 합니다 (${(file.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (picked >= NOTICE_MAX_FILES) return `파일은 공지 하나에 최대 ${NOTICE_MAX_FILES}개까지입니다`
  return null
}

/** 1.2MB · 340KB — 받는 사람이 크기를 보고 고르게 */
export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

async function uploadNoticeFile(noticeId: string, file: File): Promise<AttachedFile> {
  const type = noticeFileType(file)
  if (!type) throw new Error(`받지 않는 형식: ${file.name}`)
  // 경로는 다른 첨부와 같은 방식(시각_정리한 이름). 받을 때의 원래 이름은 서버가 주소에 싣는다
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_')
  const path = `${NOTICE_DIR}/${noticeId}/${Date.now()}_${safeName}`
  await uploadBytes(ref(getStorageClient(), path), file, { contentType: type })
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
 * 공지에 안 붙은 파일이 남지 않게.
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

/** 속지에 쓸 값 — 첨부가 없으면 키를 안 만든다(빈 배열이 남으면 "첨부가 있는데 비었다"로 오해) */
function bodyDoc(content: string, files: AttachedFile[]): NoticeBody {
  return { content: content.trim(), ...(files.length > 0 ? { files } : {}) }
}

/* ── 쓰기 ─────────────────────────────────────────────────────── */

/**
 * 새 공지 — 문서 ID는 자동. 주소에 노출되지만 공지는 검색으로 찾지 않는다.
 * 파일 경로에 공지 번호가 들어가서 **번호를 먼저 받고 → 파일 → 겉장·속지(한 묶음)** 순서로 쓴다.
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
  const batch = writeBatch(getDb())
  batch.set(noticeRef, {
    title: input.title.trim(),
    pinned: input.pinned,
    visibility: input.visibility,
    fileCount: added.length,
    authorUid,
    createdAt: now,
    updatedAt: now,
  })
  batch.set(bodyRef(noticeRef.id), bodyDoc(input.content, added))
  try {
    await batch.commit()
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
 * 파일은 **새 파일 올리기 → 겉장·속지 저장 → 뺀 파일 지우기** 순서. 저장이 실패하면 옛 파일은
 * 그대로 붙어 있어야 하므로 지우기를 맨 뒤에 둔다.
 *
 * D-113 이전 공지면 겉장의 본문(`content` · `files`)을 지우고 속지로 옮긴다 — 한 묶음이라
 * 중간에 끊겨도 본문이 사라지지 않는다.
 */
export async function updateNotice(
  prev: Notice,
  prevBody: NoticeBody,
  input: NoticeInput,
  files: { keep: AttachedFile[]; add: File[] },
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const added = await uploadAll(prev.id, files.add, onProgress)
  const next = [...files.keep, ...added]
  const batch = writeBatch(getDb())
  batch.update(doc(getDb(), COL.notices, prev.id), {
    title: input.title.trim(),
    pinned: input.pinned,
    visibility: input.visibility,
    fileCount: next.length,
    content: deleteField(),
    files: deleteField(),
    updatedAt: serverTimestamp(),
  })
  batch.set(bodyRef(prev.id), bodyDoc(input.content, next))
  try {
    await batch.commit()
  } catch (e) {
    await removeFiles(added)
    throw e
  }
  const kept = new Set(files.keep.map((f) => f.storagePath))
  await removeFiles((prevBody.files ?? []).filter((f) => !kept.has(f.storagePath)))
}

/**
 * 공지 삭제.
 *
 * 공지는 신청서와 달리 다른 자료가 참조하지 않으므로 지워도 고아가 생기지 않는다.
 * 다만 **되돌릴 수 없으므로** 화면에서 한 번 더 확인을 받는다.
 *
 * 첨부는 문서가 기억하는 것만이 아니라 **그 공지 폴더를 통째로** 비운다 — 저장이 중간에 실패해
 * 남은 파일까지 함께 치운다. D-112 때의 공개 폴더도 비운다. 폴더 비우기가 실패해도 공지는 이미
 * 지워졌으므로 로그만 남긴다.
 */
export async function deleteNotice(id: string): Promise<void> {
  const batch = writeBatch(getDb())
  batch.delete(bodyRef(id))
  batch.delete(doc(getDb(), COL.notices, id))
  await batch.commit()
  for (const dir of [NOTICE_DIR, LEGACY_NOTICE_DIR]) {
    try {
      const { items } = await listAll(ref(getStorageClient(), `${dir}/${id}`))
      await Promise.all(
        items.map((item) =>
          deleteObject(item).catch((e) =>
            console.warn('[iLINE] 공지 첨부 삭제 실패(무시):', item.fullPath, e)
          )
        )
      )
    } catch (e) {
      console.warn('[iLINE] 공지 첨부 폴더 비우기 실패(무시):', dir, e)
    }
  }
}

/**
 * D-113 이전 공지에 **공개 범위(전체 공개)와 첨부 수를 채운다** — 담당자 공지 관리 화면이 열릴 때.
 *
 * 왜 필요한가 — 알림마당 목록은 `visibility` 가 전체 공개·회원만인 것만 묻는다(위 listNotices).
 * 값이 없는 옛 공지는 그 조건에 안 걸려 **목록에서 빠진다.** 규칙은 값이 없으면 전체 공개로 봐서
 * 상세 화면은 열리지만, 목록에 없으면 찾을 수가 없다.
 *
 * 본문은 옮기지 않는다(겉장에 둔 채 읽는다 — getNoticeBody). 겉장만 고치므로 속지 규칙이 배포되기
 * 전에도 된다. `updatedAt` 은 건드리지 않는다 — 「수정됨」이 붙으면 안 된다.
 * @returns 채운 공지 수
 */
export async function backfillNoticeVisibility(notices: Notice[]): Promise<number> {
  const legacy = notices.filter((n) => !n.visibility)
  if (legacy.length === 0) return 0
  const batch = writeBatch(getDb())
  for (const n of legacy) {
    batch.update(doc(getDb(), COL.notices, n.id), {
      visibility: 'public',
      fileCount: n.files?.length ?? 0,
    })
  }
  await batch.commit()
  return legacy.length
}
