/* ================= IDIOMA (ES / CAT) =================
   Traducción de toda la interfaz. Los diccionarios están en src/lib/i18n/es.js y
   ca.js. Los componentes de Svelte llaman a t('clave') en la plantilla: t() lee el
   idioma de un $state, así que todo lo que lo use se vuelve a pintar solo al
   cambiar de idioma.

   setLang() y toggleLang() se dejan también en window (los usan los tests y
   cualquier onclick="..." que quede fuera de Svelte). */
import { es } from './i18n/es.js';
import { ca } from './i18n/ca.js';

const I18N = { es, ca };

let currentLang = localStorage.getItem('cnpenas:lang') || 'es';

const state = $state({ lang: currentLang });

window.addEventListener('app:langchange', (e) => { state.lang = e.detail; });

// Idioma activo, sin dependencia reactiva (para quien pinta "fotos" que solo cambian
// al volver a llamar a su render, como la lista de Asistencia o las fechas).
export function getLang() {
  return currentLang;
}

// Traduce una clave del diccionario; {variable} dentro del texto se sustituye por
// vars.variable. Sin dependencia reactiva: ver t() para las plantillas.
export function translate(key, vars) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || I18N.es[key] || key;
  if (vars) { Object.keys(vars).forEach((k) => { str = str.split('{' + k + '}').join(vars[k]); }); }
  return str;
}

// Igual que translate(), pero reactivo al idioma.
export function t(key, vars) {
  state.lang; // dependencia reactiva
  return translate(key, vars);
}

// Refresca el estado visual del selector de idioma (sidebar de escritorio + botón de
// la barra móvil) y el lang de <html>. Los textos los repinta Svelte con t().
export function applyI18n() {
  document.querySelectorAll('.lang-switch button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  const mobileToggle = document.getElementById('lang-toggle-mobile');
  if (mobileToggle) mobileToggle.setAttribute('data-lang', currentLang);
  document.documentElement.lang = currentLang;
}

// Cambia el idioma activo, lo guarda para la próxima visita y refresca el selector;
// las partes en Svelte se repintan solas con el evento.
export function setLang(lang) {
  if (lang !== 'es' && lang !== 'ca') return;
  currentLang = lang;
  localStorage.setItem('cnpenas:lang', lang);
  applyI18n();
  window.dispatchEvent(new CustomEvent('app:langchange', { detail: lang }));
}

export function toggleLang() {
  setLang(currentLang === 'es' ? 'ca' : 'es');
}

window.setLang = setLang;
window.toggleLang = toggleLang;
