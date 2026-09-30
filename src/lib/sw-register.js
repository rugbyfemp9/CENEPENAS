// Registro del service worker (antes js/sw-register.js): imprescindible para que
// Chrome (Android y escritorio) ofrezca instalar la web como PWA de forma automática.
// En iOS Safari no hace nada especial (Safari ignora el service worker para el
// "Añadir a pantalla de inicio"), así que no afecta a lo que ya funcionaba ahí.
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('No se ha podido registrar el service worker', err);
      });
    });
  }
}
