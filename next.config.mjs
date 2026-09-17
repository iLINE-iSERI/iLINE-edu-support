/** @type {import('next').NextConfig} */

// Firebase Storage 버킷 — 포스터 다운로드 URL 의 경로에 들어간다. 빌드 때 .env 에서 읽으므로
// 여기 값을 손으로 적지 않는다(버킷을 옮겨도 이 파일은 그대로).
const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

const nextConfig = {
  images: {
    // 산출물 갤러리 영상 썸네일 (YouTube 임베드 — D-12)
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      // 포스터 (D-86) — 우리 버킷의 공개 파일만. 버킷을 못 읽는 환경(설정 없이 빌드)에서는
      // 호스트 전체를 허용해 빌드가 막히지 않게 한다.
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        ...(bucket ? { pathname: `/v0/b/${bucket}/o/**` } : {}),
      },
    ],
    // WebP 만 — AVIF 는 첫 변환이 눈에 띄게 느리고(Vercel 문서), 글자 위주 포스터에서
    // 용량 이득이 크지 않다. 나중에 원하면 'image/avif' 를 앞에 추가.
    formats: ['image/webp'],
  },
}

export default nextConfig
