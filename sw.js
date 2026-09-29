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

const CACHE_NAME = 'cnpenas-v4';

// Rutas relativas a la carpeta donde vive este sw.js (CENEPENAS/), para que
// funcione igual si algún día cambia el nombre del repo.
const APP_SHELL = [
  '.',
  'index.html',
  'manifest.json',
  'assets/img/applogo.png',
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

  // La página en sí (index.html) va primero a la red y solo tira de caché si no hay
  // conexión. Con "stale-while-revalidate" también para ella, tras publicar una
  // versión nueva se servía el index.html antiguo de caché, que apunta a archivos
  // (build/index-<hash>.js...) que ya no existen, y esa primera carga salía rota.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('index.html')))
    );
    return;
  }

  // Para el resto (JS, CSS, imágenes): "stale-while-revalidate". Responde al momento con lo que haya en
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

// ---- Notificaciones push (Firebase Cloud Messaging) ----
// Las notificaciones llegan aquí aunque la app esté cerrada. Antes las recibía un
// segundo service worker (firebase-messaging-sw.js), pero se registraba en
// "/firebase-messaging-sw.js", que en GitHub Pages es la raíz del dominio (404), y
// aunque se hubiera encontrado se habría pisado con este: solo puede haber un service
// worker por carpeta. Así que ahora las recibe este mismo, sin el SDK de Firebase: FCM
// entrega un JSON con los campos del mensaje en "data" (title, body, url, tag), que es
// lo que manda la función de Supabase.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json()?.data || {}; } catch { /* no era JSON */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CNPENAS', {
      body: data.body || '',
      icon: 'assets/img/applogo.png',
      badge: 'assets/img/applogo.png',
      // Mismo tag = sustituye a la anterior (p.ej. dos recordatorios del mismo entreno)
      tag: data.tag || undefined,
      data: { url: data.url || '.' },
    })
  );
});

// Al tocar la notificación: si la app ya está abierta la traemos delante (en la sección
// que diga la notificación); si no, la abrimos.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '.', self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      // navigate() falla si esa ventana aún no la controla este service worker: al
      // menos queda delante.
      if (open) return open.focus().then(() => open.navigate(url)).catch(() => {});
      return self.clients.openWindow(url);
    })
  );
});
