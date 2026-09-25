// 산출물 (support_outputs) — D-76 · 09-17
//
// **정산을 본떴다.** 신청 건에 붙고, 선정(approved)된 건에만 열리고, 담당자가
// 본다. 다른 점은 하나 — 정산은 신청 건당 1건, 산출물은 **여러 건**.
//
// · 제출창은 제목 · 내용 · 파일 세 줄. 양식을 박지 않는다 (iSERI 09-17)
// · 제출하면 그 자리에서 반영된다. 승인 단계가 없다
// · 담당자는 「추가 요청」만. 요청 글은 참여자에게 보인다
// · 팀은 신청서의 팀명으로 묶는다 — 제출은 팀원 누구나, 보기는 팀 단위
// · 파일은 Storage 에만. 드라이브로 나가지 않는다 (1차 범위 — 크고, 개인정보가 늘어서)

import {
  collection,
  doc,
  setDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, deleteObject } from 'firebase/storage'
import { getDb, getStorageClient, getAuthClient, COL, STORAGE_ROOT } from './config'
import {
  teamNameOf,
  outputVisibilityOf,
  type Application,
  type AttachedFile,
  type Output,
  type Program,
} from '@/lib/types'

/* ── 파일 ─────────────────────────────────────────────────────── */

/**
 * 받는 파일 — 확장자로 판단하고 **contentType 을 우리가 정해서** 올린다.
 *
 * 브라우저는 hwp·hwpx 를 `application/octet-stream` 으로 보내는데, 그걸 규칙에서
 * 허용하면 실행 파일도 같은 이름으로 들어온다. 그래서 확장자 → 형식 표를 두고
 * 표에 없는 것은 화면에서 거르고, Storage 규칙은 표에 있는 형식만 받는다.
 */
export const OUTPUT_FILE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  hwp: 'application/x-hwp',
  hwpx: 'application/x-hwpx',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}
export const OUTPUT_MAX_BYTES = 50 * 1024 * 1024
export const OUTPUT_MAX_FILES = 10

export function outputFileType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return OUTPUT_FILE_TYPES[ext] ?? null
}

export function outputRejectReason(f: File, picked: number): string | null {
  if (!outputFileType(f)) return '받지 않는 형식입니다 (사진·PDF·문서·한글·압축·영상만)'
  if (f.size > OUTPUT_MAX_BYTES) {
    return `50MB를 넘습니다 (${(f.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (picked >= OUTPUT_MAX_FILES) return `파일은 한 건에 최대 ${OUTPUT_MAX_FILES}개까지입니다`
  return null
}

async function uploadOutputFile(uid: string, outputId: string, file: File): Promise<AttachedFile> {
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_')
  const path = `${STORAGE_ROOT}/outputs/${uid}/${outputId}/${Date.now()}_${safeName}`
  const contentType = outputFileType(file) ?? 'application/octet-stream'

  await uploadBytes(ref(getStorageClient(), path), file, { contentType })

  return {
    type: 'output',
    storagePath: path,
    fileName: file.name,
    size: file.size,
    // 배열 안에는 serverTimestamp() 를 못 넣는다 (Firestore 제약)
    uploadedAt: Timestamp.now(),
  }
}

/* ── 기간 ─────────────────────────────────────────────────────── */

/**
 * 제출 기간 — 셋 중 있는 것을 쓴다.
 *   제출 기한이 있으면 그것 → 없으면 활동 기간(종료일은 **그날 끝까지**) →
 *   그것도 없으면 제한 없음.
 * 규칙(firestore.rules · outputWindowOpen)과 같은 계산이어야 한다.
 */
export function outputWindow(p: Program): { opens?: Date; closes?: Date } {
  const opens = p.outputOpensAt?.toDate() ?? p.activityStart?.toDate()
  let closes = p.outputClosesAt?.toDate()
  if (!closes && p.activityEnd) {
    // 활동 종료일은 00:00 으로 저장돼 있다 — 그날 밤까지 받는다
    closes = new Date(p.activityEnd.toDate().getTime() + 24 * 60 * 60 * 1000 - 1)
  }
  return { opens, closes }
}

export type OutputPhase = 'upcoming' | 'open' | 'closed'

export function outputPhase(p: Program, now = new Date()): OutputPhase {
  const { opens, closes } = outputWindow(p)
  if (opens && now < opens) return 'upcoming'
  if (closes && now > closes) return 'closed'
  return 'open'
}

/** 이 신청 건으로 지금 산출물을 낼 수 있는가 — 화면용. 최종 판정은 규칙 */
export function canSubmitOutput(app: Application, program: Program | null, now = new Date()): boolean {
  if (!program || !program.published) return false
  if (app.status !== 'approved') return false
  return outputPhase(program, now) === 'open'
}

/* ── 제출 · 수정 ─────────────────────────────────────────────── */

export interface OutputInput {
  application: Application
  program: Program
  uid: string
  /** 회원 문서에서 — 제출 시점 사본으로 박는다 */
  authorName: string
  authorAffiliation?: string
  title: string
  text: string
  files: File[]
}

/**
 * 제출. 문서 ID 를 먼저 받아 파일 경로에 쓰고, 파일을 다 올린 뒤 문서를 쓴다 —
 * 업로드가 중간에 실패하면 문서가 안 만들어져 '파일 없는 제출'이 남지 않는다.
 * (파일만 남을 수는 있다 — 고아 파일 정리는 신청서와 같은 과제)
 */
export async function submitOutput(input: OutputInput): Promise<string> {
  const { application, program, uid, files } = input
  const col = collection(getDb(), COL.outputs)
  const newRef = doc(col)

  const uploaded: AttachedFile[] = []
  for (const f of files) uploaded.push(await uploadOutputFile(uid, newRef.id, f))

  const now = serverTimestamp()
  const data: Record<string, unknown> = {
    applicationId: application.id,
    uid,
    status: 'submitted',
    programId: program.id,
    programTitle: program.title,
    authorName: input.authorName,
    title: input.title.trim(),
    files: uploaded,
    hiddenByStaff: false,
    editCount: 0,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  // 🔴 여기서 복사한 팀명은 **나중에 안 바뀐다.** 공고를 넘기지 않으면 「칸 추가」
  //    팀명을 못 찾아 팀명 없는 산출물로 영구히 남는다 (D-104 · D-105)
  const team = teamNameOf(application, program)
  if (team) data.teamName = team
  if (input.authorAffiliation) data.authorAffiliation = input.authorAffiliation
  if (input.text.trim()) data.text = input.text.trim()

  // ID 를 파일 경로에 이미 썼으므로 addDoc 이 아니라 setDoc
  await setDoc(newRef, data)
  return newRef.id
}

export interface OutputEditInput {
  output: Output
  uid: string
  title: string
  text: string
  files: File[]
  /** 남길 기존 파일. 여기서 빠진 것은 Storage 에서 지운다 */
  keepFiles: AttachedFile[]
}

/**
 * 「다시 제출하기」 — 같은 문서를 제자리에서 고친다 (D-73 방식).
 * 추가 요청 상태였다면 제출됨으로 돌아가고 요청 글은 비운다(정산과 같음).
 * 규칙이 바꿀 수 있는 칸을 못 박아 두었다 — 새 칸을 쓰려면 규칙도 고친다.
 */
export async function updateMyOutput(input: OutputEditInput): Promise<void> {
  const { output, uid, files } = input
  const prev = output.files ?? []
  const keepPaths = new Set(input.keepFiles.map((f) => f.storagePath))
  const removed = prev.filter((f) => !keepPaths.has(f.storagePath))

  const added: AttachedFile[] = []
  for (const f of files) added.push(await uploadOutputFile(uid, output.id, f))

  for (const r of removed) {
    await deleteObject(ref(getStorageClient(), r.storagePath)).catch((e) =>
      console.warn('[iLINE] 뺀 파일 삭제 실패(목록에서는 빠짐):', e)
    )
  }

  const text = input.text.trim()
  await updateDoc(doc(getDb(), COL.outputs, output.id), {
    title: input.title.trim(),
    text: text ? text : deleteField(),
    files: [...input.keepFiles, ...added],
    status: 'submitted',
    reviewNote: deleteField(),
    editCount: increment(1),
    lastEditedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/* ── 조회 ─────────────────────────────────────────────────────── */

function toOutput(id: string, data: Record<string, unknown>): Output {
  return { id, ...data } as Output
}

function byNewest(a: Output, b: Output) {
  return (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0)
}

export async function getOutput(id: string): Promise<Output | null> {
  const snap = await getDoc(doc(getDb(), COL.outputs, id))
  return snap.exists() ? toOutput(snap.id, snap.data()) : null
}

/** 내가 올린 것 전부 — 프로그램별로 나누는 건 화면이 한다 */
export async function listMyOutputs(uid: string): Promise<Output[]> {
  const q = query(collection(getDb(), COL.outputs), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => toOutput(d.id, d.data())).sort(byNewest)
}

/**
 * 참여자 공유 목록 — 그 프로그램의 **내려지지 않은** 제출물 전부.
 * 규칙이 프로그램의 outputVisibility == 'members' 일 때만 통과시킨다.
 * `hiddenByStaff == false` 조건은 규칙과 짝이다 — 빼면 질의가 통째로 거부된다.
 */
export async function listSharedOutputs(programId: string): Promise<Output[]> {
  const q = query(
    collection(getDb(), COL.outputs),
    where('programId', '==', programId),
    where('hiddenByStaff', '==', false)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => toOutput(d.id, d.data())).sort(byNewest)
}

/* ── 팀 — 서버를 거친다 ──────────────────────────────────────── */

async function authedFetch(path: string, body: unknown) {
  const token = await getAuthClient().currentUser?.getIdToken()
  if (!token) throw new Error('로그인 정보를 확인할 수 없습니다.')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.')
  return data
}

/** 서버가 보내는 산출물 — Timestamp 는 밀리초 숫자로 온다 */
type WireOutput = Omit<
  Output,
  'submittedAt' | 'createdAt' | 'updatedAt' | 'lastEditedAt' | 'reviewedAt' | 'hiddenAt' | 'sheetSyncedAt' | 'files'
> & {
  submittedAt?: number
  createdAt?: number
  updatedAt?: number
  lastEditedAt?: number
  reviewedAt?: number
  hiddenAt?: number
  sheetSyncedAt?: number
  files: (Omit<AttachedFile, 'uploadedAt'> & { uploadedAt?: number })[]
}

function fromWire(w: WireOutput): Output {
  const ts = (n?: number) => (typeof n === 'number' ? Timestamp.fromMillis(n) : undefined)
  return {
    ...w,
    files: (w.files ?? []).map((f) => ({ ...f, uploadedAt: ts(f.uploadedAt) ?? Timestamp.now() })),
    submittedAt: ts(w.submittedAt),
    createdAt: ts(w.createdAt) ?? Timestamp.now(),
    updatedAt: ts(w.updatedAt) ?? Timestamp.now(),
    lastEditedAt: ts(w.lastEditedAt),
    reviewedAt: ts(w.reviewedAt),
    hiddenAt: ts(w.hiddenAt),
    sheetSyncedAt: ts(w.sheetSyncedAt),
  } as Output
}

/**
 * 우리 팀이 올린 것 — 같은 프로그램에 **같은 팀명으로 신청한 다른 계정**의
 * 제출물까지. 규칙으로는 "내가 그 팀인가"를 판정할 수 없어(다른 사람 신청서를
 * 읽어야 한다) 서버가 대신 확인하고 돌려준다. 내 것도 함께 온다.
 */
export async function listTeamOutputs(programId: string): Promise<Output[]> {
  const data = (await authedFetch('/api/outputs/team', { programId })) as { outputs: WireOutput[] }
  return (data.outputs ?? []).map(fromWire).sort(byNewest)
}

/* ── 담당자 ───────────────────────────────────────────────────── */

export async function listOutputsByProgram(programId: string): Promise<Output[]> {
  const q = query(collection(getDb(), COL.outputs), where('programId', '==', programId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => toOutput(d.id, d.data())).sort(byNewest)
}

/** 추가 요청 — 글을 달면 상태가 '추가 요청'이 되고 참여자에게 보인다 */
export async function requestOutputRevision(id: string, note: string, staffUid: string): Promise<void> {
  await updateDoc(doc(getDb(), COL.outputs, id), {
    status: 'revision',
    reviewNote: note.trim(),
    reviewedBy: staffUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** 요청 거두기 — 담당자가 마음을 바꿨을 때. 글은 지우고 제출됨으로 */
export async function withdrawOutputRevision(id: string): Promise<void> {
  await updateDoc(doc(getDb(), COL.outputs, id), {
    status: 'submitted',
    reviewNote: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

/** 내리기 / 되살리기 — 지우지 않는다. 본인·담당자에게는 계속 보인다 */
export async function setOutputHidden(id: string, hidden: boolean): Promise<void> {
  await updateDoc(doc(getDb(), COL.outputs, id), {
    hiddenByStaff: hidden,
    hiddenAt: hidden ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  })
}

/* ── 표시용 ───────────────────────────────────────────────────── */

/** 공유 화면에 이름 대신 띄우는 한 줄 — 팀명, 없으면 소속·전공 */
export function outputOwnerLabel(o: Pick<Output, 'teamName' | 'authorAffiliation'>): string {
  return o.teamName ? `${o.teamName} 팀` : o.authorAffiliation || '참여자'
}

/** 프로그램이 참여자 공유인가 — 카드에 「참여자 자료실」 링크를 붙일지 */
export function isShared(p: Program): boolean {
  return outputVisibilityOf(p) === 'members'
}

/* ── 시트 반영 (3단계에서) ───────────────────────────────────── */

/** 제출·수정·요청 직후. 실패해도 제출은 끝난 것이라 기록만 한다 */
export async function requestOutputSync(outputId: string): Promise<void> {
  try {
    await authedFetch('/api/sync/output', { outputId })
  } catch (e) {
    console.warn('[iLINE] 산출물 시트 반영 실패(제출은 정상 처리됨):', e)
  }
}
