import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    base: './',
    plugins: standalone ? [viteSingleFile()] : [],
    build: standalone
      ? { outDir: 'standalone' }
      : { rollupOptions: { output: { manualChunks: {
          three: ['three', 'three/addons/controls/OrbitControls.js'],
          shapefile: ['shapefile', 'fflate'],
        } } } },
  };
});
