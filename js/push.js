window.__pendingPushToken = null;

async function savePushToken(token, platform) {
  if (!token) return;
  
  // Comprobación segura de currentAuthUserId
  const userId = (typeof currentAuthUserId !== 'undefined') ? currentAuthUserId : null;

  if (!userId) {
    window.__pendingPushToken = { token, platform };
    return;
  }

  try {
    await supabaseClient.from('push_subscriptions').upsert({
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

window.flushPendingPushToken = function() {
  if (window.__pendingPushToken) {
    const { token, platform } = window.__pendingPushToken;
    window.__pendingPushToken = null;
    savePushToken(token, platform);
  }
};

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

async function initWebPush() {
  // Si estamos dentro de la app nativa de Capacitor, cancelamos el flujo web
  if (window.Capacitor?.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isIOS && !isStandalone) return;

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js');

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

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await getToken(messaging, {
      vapidKey: 'BKIKaBB_6rqhTxuDif6zQiDcfgSpJbtTklLsPPe5MuodbcfyE3n51we_xmIuUNrkae958b62n9cyKOrEvPrGMR0',
      serviceWorkerRegistration: registration
    });
    savePushToken(token, 'web');
  } catch (error) {
    console.log('Notificaciones web no disponibles en este entorno.', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNativePush();
  initWebPush();
});
