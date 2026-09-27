/* ================= IDIOMA (ES / CAT) =================
   Traducción de toda la interfaz. Los diccionarios están en src/lib/i18n/es.js y
   ca.js. Los componentes de Svelte llaman a t('clave') en la plantilla: t() lee el
   idioma de un $state, así que todo lo que lo use se vuelve a pintar solo al
   cambiar de idioma.

   Los textos fijos que quedan en index.html se marcan con data-i18n="clave" (o
   data-i18n-attr="atributo:clave,..." para atributos como aria-label/title) y
   applyI18n() los sustituye al cambiar de idioma. Los componentes de Svelte NO usan
   data-i18n (applyI18n pisaría nodos que gestiona Svelte).

   setLang() y toggleLang() se dejan también en window: los llaman los onclick del
   selector de idioma de index.html. */
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

// Traduce todo lo marcado con data-i18n / data-i18n-attr, y refresca el estado
// visual del selector de idioma (sidebar de escritorio + botón de la barra móvil)
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = translate(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, translate(key));
    });
  });
  document.querySelectorAll('.lang-switch button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  const mobileToggle = document.getElementById('lang-toggle-mobile');
  if (mobileToggle) mobileToggle.setAttribute('data-lang', currentLang);
  document.documentElement.lang = currentLang;
}

// Cambia el idioma activo, lo guarda para la próxima visita y refresca los textos
// fijos de index.html; las partes en Svelte se repintan solas con el evento.
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
