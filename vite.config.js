import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// IWSDK importa su propia copia de three (super-three 0.181): una sola instancia.
const sharedDeps = ['three', '@pmndrs/uikit', '@drawcall/uikitml'];
process.env.IWSDK_DEV_OPEN ??= 'false';

export default defineConfig({
  plugins: [iwsdkDev({ https: process.env.ANGAR_HTTP !== '1' })],
  server: { host: '0.0.0.0', cors: true },
  resolve: {
    dedupe: sharedDeps,
    // 4,6 MB de íconos de paneles UIKitML que no usamos (ver src/stubs/uikit-lucide.js).
    alias: [{ find: /^@pmndrs\/uikit-lucide$/, replacement: fileURLToPath(new URL('./src/stubs/uikit-lucide.js', import.meta.url)) }],
  },
  optimizeDeps: { exclude: ['@babylonjs/havok'], include: sharedDeps, esbuildOptions: { target: 'esnext' } },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks(id) { if (/node_modules\/(three|three-mesh-bvh)\//.test(id)) return 'three'; } } },
  },
});
