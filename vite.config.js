import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync } from 'node:fs';

// El código antiguo (js/), los estilos (css/), las imágenes (assets/) y los service
// workers se sirven tal cual, sin pasar por Vite: en desarrollo ya están en la raíz del
// proyecto y al compilar se copian a dist/ en la misma ruta. Así las rutas de siempre
// (js/..., css/..., assets/img/...) siguen funcionando igual en los dos casos.
const STATIC = ['js', 'css', 'assets', 'sw.js', 'manifest.json', 'firebase-messaging-sw.js'];
const STATIC_URL = /^(\.\/)?(js|css|assets)\/|^(\.\/)?manifest\.json$/;

function legacyStatic() {
  let outDir;
  return {
    name: 'legacy-static',
    configResolved(config) { outDir = config.build.outDir; },
    // Que Vite no intente empaquetar ni renombrar los <script>/<link>/<img> que apuntan
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
  build: { assetsDir: 'build' },
});
