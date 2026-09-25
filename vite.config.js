import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Rutas relativas: la web se sirve desde https://rugbyfemp9.github.io/CENEPENAS/
  // (y la app de Capacitor carga esa misma URL), así que nada puede colgar de "/".
  base: './',
  // Los archivos que genera Vite van a build/, para no mezclarse con public/assets/img.
  build: { assetsDir: 'build' },
});
