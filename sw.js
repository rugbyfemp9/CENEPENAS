// Service worker mínimo para CNPENAS.
//
// Su único propósito imprescindible es EXISTIR y estar registrado: Chrome exige un
// service worker para ofrecer la instalación automática de la PWA (el aviso de
// "Instalar app"). De paso, aprovechamos para cachear el "cascarón" de la app
// (index.html, manifest.json, el logo) y que cargue algo más rápido en visitas
// repetidas, incluso con mala conexión.
//
// IMPORTANTE: nunca tocamos peticiones que no sean a nuestro propio dominio.
// Todo lo que va a Supabase (datos en vivo: perfiles, asistencia, multas...),
// Google Fonts o el CDN de supabase-js sigue yendo siempre directo a la red,
// sin pasar por caché, para no servir nunca datos del club desactualizados.

const CACHE_NAME = 'cnpenas-v1';

// Rutas relativas a la carpeta donde vive este sw.js (CENEPENAS/), para que
// funcione igual si algún día cambia el nombre del repo.
const APP_SHELL = [
  '.',
  'index.html',
  'manifest.json',
  'foto/applogo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // No esperamos a que se cierren las pestañas antiguas para activar la versión nueva
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo interceptamos peticiones GET a nuestro propio origen (el resto —
  // Supabase, fuentes, CDN, o cualquier POST/PUT— va siempre directo a la red).
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Estrategia "stale-while-revalidate": responde al momento con lo que haya en
  // caché (si hay algo) para que se sienta rápida, y en paralelo pide la versión
  // fresca a la red y actualiza la caché para la próxima vez.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
