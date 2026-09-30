# CENEPENAS

Panel del club CN Peñas. Web estática publicada en GitHub Pages (la app de Capacitor
carga esa misma URL). Está hecha con [Svelte 5](https://svelte.dev) y se compila con
[Vite](https://vite.dev). Los datos viven en Supabase y las notificaciones push van por
Firebase.

## Desarrollo

Hace falta Node 22 o superior.

```
npm install
npm run dev        # servidor de desarrollo con recarga al guardar
npm run build      # compila en dist/
npm run preview    # sirve dist/ tal cual se publicará
npm run test:e2e   # tests en un navegador de verdad, con un Supabase simulado
```

Ojo: con `npm run dev` y `npm run preview` la web usa el **Supabase real**, así que lo
que guardes ahí es de verdad. Los tests, en cambio, nunca tocan la base de datos real.

Al fusionar en `main`, GitHub Actions compila y publica la web
(`.github/workflows/deploy.yml`). Requisito, una sola vez: en el repositorio,
Settings → Pages → Source: **GitHub Actions**. En cada pull request se compila y se
pasan los tests (`.github/workflows/ci.yml`).

## Estructura

```
index.html                  <head> (manifest, fuentes...) y el punto de montaje
src/
  main.js                   Arranque: estilos, armazón, secciones y el orden de inicio
  shell/                    Armazón: login/registro, navegación, barra lateral y
                            superior, nav inferior, Inicio, Vestuario, Comisiones
  features/<sección>/       Una carpeta por sección: estado y lógica en *.svelte.js,
                            y sus componentes .svelte
  lib/                      Piezas compartidas: idioma (i18n/ + i18n.svelte.js),
                            sesión y roster, permisos, Supabase, almacenamiento,
                            fechas, modal, avatar, push, service worker...
css/                        Estilos, uno por zona (se importan en src/main.js; el orden
                            es la cascada)
assets/img/                 Logos, escudos y portadas de la galería
sw.js                       Service worker (instalación como PWA + caché)
firebase-messaging-sw.js    Service worker de las notificaciones en segundo plano
tests/e2e/                  Tests de Playwright
scripts/                    Utilidades (comparar capturas de pantalla)
config.toml                 Configuración local de Supabase
```

`assets/`, el manifest y los service workers no pasan por Vite: en desarrollo se sirven
desde la raíz y al compilar se copian tal cual a `dist/` (ver `vite.config.js`), así que
sus rutas (`assets/img/...`) son las mismas en los dos casos.

## Cómo está organizado el código

- Cada sección guarda su estado en un `*.svelte.js` (con `$state`) y lo exporta junto
  con las funciones que lo cambian; los componentes solo lo pintan. Si una sección
  necesita algo de otra, lo importa directamente.
- Los textos pasan siempre por `t('clave')` (`src/lib/i18n.svelte.js`); el diccionario
  está en `src/lib/i18n/es.js` y `ca.js`. Al cambiar de idioma todo se vuelve a pintar
  solo.
- Todo lo que viene de Supabase se escapa automáticamente (Svelte). Las URLs que vienen
  de los datos pasan además por `safeUrl()` (`src/lib/url.js`), que no deja pasar
  `javascript:`.
- `window.setSection`, `window.setLang` y `window.toggleLang` siguen siendo globales:
  los usan los tests.

## Tests

`npm run test:e2e` compila la web y la abre en Chromium (Playwright) contra un Supabase
en memoria (`tests/e2e/support/fake-supabase.js`, con los datos de
`tests/e2e/fixtures/seed.js`), con el reloj fijado y sin red externa. Hay una spec por
sección, que describe lo que se ve y lo que se guarda en Supabase; los `// NOTE:` marcan
comportamientos raros que se han dejado tal cual a propósito.

Para comprobar que un cambio no altera nada visualmente, se pueden comparar capturas de
todas las pantallas antes y después:

```
SNAPSHOT_DIR=.snapshots/antes npx playwright test snapshot
# ...cambios...
SNAPSHOT_DIR=.snapshots/despues npx playwright test snapshot
node scripts/compare-snapshots.mjs .snapshots/antes .snapshots/despues
```
