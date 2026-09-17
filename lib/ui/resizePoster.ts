/**
 * 포스터를 올리기 전에 브라우저에서 줄인다 (D-86 2단계 · 09-18).
 *
 * 09-18 실측: 담당자가 인쇄용 원본(5346×7560 · 40MP)을 그대로 올렸고, 그 파일이 목록의
 * 260px 칸까지 내려가고 있었다. 화면 최적화(next/image)를 붙여도 원본이 이만하면
 * Vercel 변환이 느리거나 실패할 수 있어 **저장 직전에 긴 변 2400px · WebP 82** 로 줄인다.
 * 2400 이면 뷰어 250% 확대에서도 A4 포스터 글자가 읽힌다.
 *
 * 방법: `createImageBitmap(file, { resizeWidth, resizeHeight })` — 40MP 를 캔버스에 통째로
 * 그리지 않는다(iOS Safari 캔버스 한도 16MP). 회전 정보(EXIF)는 브라우저가 처리한다.
 * WebP 인코딩을 못 하는 브라우저(옛 Safari)는 JPEG 로. 이미 작고 가벼운 파일은 손대지 않는다.
 * 서버는 없다 — 담당자 PC 에서 끝난다.
 */

export const POSTER_LONG_EDGE = 2400
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85
/** 이보다 작고 크기도 이 안이면 그대로 올린다 — 이미 작은 그림을 다시 굽지 않는다 */
const KEEP_BYTES = 600 * 1024

export type PreparedPoster = { blob: Blob; ext: 'webp' | 'jpg'; width: number; height: number }

function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽을 수 없습니다'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * 줄인 결과. 손댈 필요가 없으면 `null` — 호출한 쪽이 원본을 그대로 올린다.
 * 브라우저가 못 하는 환경이면(createImageBitmap 없음) 역시 null.
 */
export async function preparePoster(file: File): Promise<PreparedPoster | null> {
  if (typeof createImageBitmap !== 'function') return null
  const { width, height } = await readSize(file)
  const long = Math.max(width, height)
  if (long <= POSTER_LONG_EDGE && file.size <= KEEP_BYTES) return null

  const scale = Math.min(1, POSTER_LONG_EDGE / long)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  const bitmap = await createImageBitmap(file, {
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: 'high',
  })
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return null
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let blob = await toBlob(canvas, 'image/webp', WEBP_QUALITY)
  let ext: 'webp' | 'jpg' = 'webp'
  if (!blob || blob.type !== 'image/webp') {
    // WebP 인코딩이 안 되는 브라우저 — 흰 바탕을 깔고 JPEG 로 (JPEG 는 투명이 없다)
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    blob = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY)
    ext = 'jpg'
  }
  if (!blob) return null
  // 줄였는데 더 커졌으면(이미 잘 압축된 작은 파일) 원본이 낫다
  if (scale === 1 && blob.size >= file.size) return null
  return { blob, ext, width: w, height: h }
}
