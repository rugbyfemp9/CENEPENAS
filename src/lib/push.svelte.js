// ================= NOTIFICACIONES PUSH (CAPACITOR / FIREBASE + WEB PUSH PARA LA PWA) =================
// (antes js/push.js) El token que llega antes de iniciar sesión se guarda en
// window.__pendingPushToken y se envía a Supabase con flushPendingPushToken() en
// cuanto se conoce el id de la cuenta (onAuthenticated, src/shell/auth.svelte.js).
// Los dos se dejan en window, como antes, por si la app nativa los usa desde fuera.
import { supabase } from './supabase.js';
import { auth } from './session.svelte.js';

async function savePushToken(token, platform) {
  if (!token) return;

  // Id de quien ha iniciado sesión (src/lib/session.svelte.js)
  const userId = auth.userId;

  if (!userId) {
    window.__pendingPushToken = { token, platform };
    return;
  }

  try {
    await supabase.from('push_subscriptions').upsert({
      profile_id: userId,
      fcm_token: token,
      platform: platform,
      updated_at: new Date().toISOString()
    }, { onConflict: 'fcm_token' });
    console.log('Token FCM guardado correctamente en Supabase:', token);
  } catch (e) {
    console.error('Error al guardar el token de notificaciones:', e);
  }
}

export function flushPendingPushToken() {
  if (window.__pendingPushToken) {
    const { token, platform } = window.__pendingPushToken;
    window.__pendingPushToken = null;
    savePushToken(token, platform);
  }
}

async function initNativePush() {
  const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;

  if (!PushNotifications) {
    console.log('Notificaciones nativas no disponibles.');
    return;
  }

  try {
    PushNotifications.addListener('registration', (token) => {
      console.log('Token FCM recibido nativamente:', token.value);
      savePushToken(token.value, 'android');
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error al registrar dispositivo en FCM:', error);
    });

    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
    } else {
      console.warn('El usuario denegó los permisos de notificación.');
    }

  } catch (error) {
    console.error('Error en flujo de Push Notifications nativo:', error);
  }
}

// ---- Web push (la web instalada en el móvil, o el navegador) ----
// El permiso ya no se pide solo al abrir la app: iOS únicamente enseña el aviso si se
// pide al tocar algo, y Chrome silencia los avisos que salen nada más cargar. Así que,
// mientras no se haya decidido, Inicio enseña un banner (PushBanner.svelte) y el permiso
// se pide al tocarlo. Si ya se había dado, el token se renueva en silencio al arrancar.
const DISMISSED_KEY = 'cnpenas:push-banner-dismissed';

export const pushBanner = $state({ visible: false });

function webPushSupported() {
  // Dentro de la app nativa de Capacitor va por initNativePush()
  if (window.Capacitor?.isNativePlatform?.()) return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return false;
  // En iPhone solo hay notificaciones con la web añadida a la pantalla de inicio
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return !isIOS || isStandalone;
}

async function subscribeWebPush() {
  try {
    // Firebase se sigue cargando del CDN de gstatic solo cuando hace falta (no pasa por Vite).
    const { initializeApp } = await import(/* @vite-ignore */ 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const { getMessaging, getToken } = await import(/* @vite-ignore */ 'https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js');

    const firebaseConfig = {
      apiKey: 'AIzaSyDl09-KbLYjSGRwXtrAgIyUL3_sx0VJD4I',
      authDomain: 'cnpn-app.firebaseapp.com',
      projectId: 'cnpn-app',
      storageBucket: 'cnpn-app.firebasestorage.app',
      messagingSenderId: '33333417478',
      appId: '1:33333417478:web:f8076c884a9af5ff7a1587',
      measurementId: 'G-29YF40YS5C'
    };
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // El mismo service worker de la app (sw.js, ruta relativa: la web vive en
    // /CENEPENAS/), que es el que enseña las notificaciones que llegan.
    const registration = await navigator.serviceWorker.register('sw.js');

    const token = await getToken(messaging, {
      vapidKey: 'BKIKaBB_6rqhTxuDif6zQiDcfgSpJbtTklLsPPe5MuodbcfyE3n51we_xmIuUNrkae958b62n9cyKOrEvPrGMR0',
      serviceWorkerRegistration: registration
    });
    savePushToken(token, 'web');
  } catch (error) {
    console.log('Notificaciones web no disponibles en este entorno.', error);
  }
}

function initWebPush() {
  if (!webPushSupported()) return;

  if (Notification.permission === 'granted') {
    subscribeWebPush();
    return;
  }
  let dismissed = false;
  try { dismissed = localStorage.getItem(DISMISSED_KEY) === '1'; } catch { /* sin almacenamiento */ }
  pushBanner.visible = Notification.permission === 'default' && !dismissed;
}

// Botón "Activar" del banner: aquí sí se puede pedir el permiso (viene de un toque).
export async function enableWebPush() {
  pushBanner.visible = false;
  const permission = await Notification.requestPermission();
  if (permission === 'granted') subscribeWebPush();
}

// "Ahora no": no vuelve a salir en este dispositivo (se puede activar desde los
// ajustes del navegador).
export function dismissPushBanner() {
  pushBanner.visible = false;
  try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* sin almacenamiento */ }
}

// Se llama al arrancar (src/main.js), lo primero, igual que cuando js/push.js era el
// primer <script> de index.html.
export function installPush() {
  window.__pendingPushToken = null;
  window.flushPendingPushToken = flushPendingPushToken;
  document.addEventListener('DOMContentLoaded', () => {
    initNativePush();
    initWebPush();
  });
}
