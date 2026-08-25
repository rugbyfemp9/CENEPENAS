importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDl09-KbLYjSGRwXtrAgIyUL3_sx0VJD4I",
  authDomain: "cnpn-app.firebaseapp.com",
  projectId: "cnpn-app",
  storageBucket: "cnpn-app.firebasestorage.app",
  messagingSenderId: "33333417478",
  appId: "1:33333417478:web:f8076c884a9af5ff7a1587",
  measurementId: "G-29YF40YS5C"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});