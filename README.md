# CENEPENAS

Panel del club CN Peñas. Web estática publicada en GitHub Pages (la app de Capacitor
carga esa misma URL). Los datos viven en Supabase y las notificaciones push van por
Firebase. Se compila con [Vite](https://vite.dev) y se está migrando a
[Svelte](https://svelte.dev) sección a sección.

## Desarrollo

Hace falta Node 22 o superior.

```
npm install
npm run dev        # servidor de desarrollo con recarga al guardar
npm run build      # compila en dist/
npm run preview    # sirve dist/ tal cual se publicará
npm run test:e2e   # tests en un navegador de verdad, con un Supabase simulado
```

Los tests nunca tocan la base de datos real: `tests/e2e/support/fake-supabase.js`
responde a todas las llamadas con los datos de `tests/e2e/fixtures/seed.js`. Ojo: con
`npm run dev` la web sí usa el Supabase real, así que lo que guardes ahí es de verdad.

Al fusionar en `main`, GitHub Actions compila y publica la web
(`.github/workflows/deploy.yml`). Requisito, una sola vez: en el repositorio,
Settings → Pages → Source: **GitHub Actions**.

## Estructura

```
index.html            Marcado de las pantallas aún no migradas + orden de carga
src/                  La parte en Svelte
  main.js             Arranque: monta las secciones migradas y luego llama a legacyBoot()
  lib/                Piezas compartidas (idioma, sesión, puente con el código antiguo...)
  features/<sección>/ Una carpeta por sección migrada: estado (*.svelte.js) + componentes
public/               Se copia tal cual a dist/
  js/                 Código antiguo, <script> clásicos (se va vaciando con la migración)
    core/             Almacenamiento, idioma, Supabase, sesión, estado, navegación...
    features/         Una sección por archivo
    main.js           legacyBoot(): lo que el código antiguo ejecuta al arrancar
  css/                Estilos, uno por sección (el orden de los <link> es la cascada)
  assets/img/         Logos, escudos y portadas de la galería
  sw.js               Service worker (instalación como PWA + caché)
tests/e2e/            Tests de Playwright
config.toml           Configuración local de Supabase
```

## Cómo conviven el código antiguo y Svelte

- El código de `public/js/` son `<script>` clásicos: comparten el ámbito global, así
  que sus funciones se pueden llamar desde cualquier archivo y desde los
  `onclick="..."` del HTML. No arrancan solos: solo declaran funciones y estado.
- `src/main.js` se ejecuta después. Monta los componentes de las secciones migradas,
  deja en `window.appBridge` lo que el código antiguo puede llamar de ellas y, al final,
  llama a `legacyBoot()` para arrancar el resto.
- Desde Svelte, todo lo que se lee del código antiguo pasa por `src/lib/legacy.js`.
- El idioma: `setLang()` lanza el evento `app:langchange` y `src/lib/i18n.svelte.js`
  lo convierte en estado reactivo, así que los componentes se traducen solos.

Para migrar una sección: mover su estado y su lógica a
`src/features/<sección>/<sección>.svelte.js`, su marcado a componentes, sustituir en el
código antiguo las llamadas a esa sección por `appBridge.<sección>.…`, borrar su
archivo de `public/js/features/` y comprobar que los tests siguen pasando. Para
comparar pantallas antes y después:

```
SNAPSHOT_DIR=.snapshots/antes npx playwright test snapshot
# ...cambios...
SNAPSHOT_DIR=.snapshots/despues npx playwright test snapshot
node scripts/compare-snapshots.mjs .snapshots/antes .snapshots/despues
```
