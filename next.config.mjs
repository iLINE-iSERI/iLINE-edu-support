/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 산출물 갤러리 영상 썸네일 (YouTube 임베드 — D-12)
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      // Firebase Storage 이미지
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
}

export default nextConfig
