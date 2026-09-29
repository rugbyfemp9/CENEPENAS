import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync } from 'node:fs';

// Las imágenes (assets/), el manifest y los service workers se sirven tal cual, sin
// pasar por Vite: en desarrollo ya están en la raíz del proyecto y al compilar se copian
// a dist/ en la misma ruta, así que las rutas de siempre (assets/img/...) funcionan
// igual en los dos casos. Los estilos sí los empaqueta Vite (se importan en src/main.js).
const STATIC = ['assets', 'sw.js', 'manifest.json'];
const STATIC_URL = /^(\.\/)?assets\/|^(\.\/)?manifest\.json$/;

function legacyStatic() {
  let outDir;
  return {
    name: 'legacy-static',
    configResolved(config) { outDir = config.build.outDir; },
    // Que Vite no intente empaquetar ni renombrar los <link>/<img> que apuntan
    // a esos archivos (marcándolos con vite-ignore antes de que procese el HTML).
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/<(script|link|img)\b([^>]*?)\s(src|href)="([^"]+)"/g,
        (tag, name, before, attr, url) => (STATIC_URL.test(url) ? `<${name}${before} vite-ignore ${attr}="${url}"` : tag)),
    },
    closeBundle() {
      if (!outDir) return;
      for (const p of STATIC) cpSync(p, `${outDir}/${p}`, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), legacyStatic()],
  // Rutas relativas: la web se sirve desde https://rugbyfemp9.github.io/CENEPENAS/
  // (y la app de Capacitor carga esa misma URL), así que nada puede colgar de "/".
  base: './',
  publicDir: false,
  // Los archivos que genera Vite van a build/, para no mezclarse con assets/img.
  // supabase-js va en su propio archivo: cambia mucho menos que la app, así que el
  // navegador lo sigue teniendo en caché después de cada publicación.
  // La app en sí es un único bundle (~500 kB sin comprimir, ~140 kB con gzip): se sube
  // el límite del aviso de tamaño.
  build: {
    assetsDir: 'build',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/@supabase/') ? 'supabase' : undefined),
      },
    },
  },
});
