import { defineConfig } from 'vite';

// 순수 vanilla JS 프로젝트라 특별한 설정은 없음.
// Vercel 기본값(base '/')으로 그대로 배포됨.
export default defineConfig({
  build: {
    outDir: 'dist',
  },
});
