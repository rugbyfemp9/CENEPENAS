// Punto de entrada de la app (el único <script> de index.html).
//
//   1. notificaciones push, el <select> que oculta la nav inferior y el service worker;
//   2. monta el armazón (src/shell/App.svelte) en el <div data-mount="app">;
//   3. monta cada sección dentro del armazón (src/features/*/index.js);
//   4. arranca la app, en el mismo orden de siempre (antes legacyBoot(), js/main.js).
import { mountAt } from './lib/mount.js';
import { installPush } from './lib/push.js';
import { registerServiceWorker } from './lib/sw-register.js';
import { refreshSession } from './lib/session.svelte.js';
import { supabase } from './lib/supabase.js';
import { applyI18n } from './lib/i18n.svelte.js';
import App from './shell/App.svelte';
import { setSection, installHistory, watchSelectFocus } from './shell/navigation.svelte.js';
import { onAuthenticated } from './shell/auth.svelte.js';
import * as galeria from './features/galeria/index.js';
import * as test from './features/test/index.js';
import * as liga from './features/liga/index.js';
import * as avisos from './features/avisos/index.js';
import * as tricount from './features/tricount/index.js';
import * as tesoreria from './features/tesoreria/index.js';
import * as comiTercerTemps from './features/comi-tercer-temps/index.js';
import * as gym from './features/gym/index.js';
import * as fantasy from './features/fantasy/index.js';
import * as multas from './features/multas/index.js';
import * as jugadoras from './features/jugadoras/index.js';
import * as perfil from './features/perfil/index.js';
import * as wellness from './features/wellness/index.js';
import * as partidos from './features/partidos/index.js';
import * as actas from './features/actas/index.js';
import * as tullidas from './features/tullidas/index.js';
import * as tercerTiempo from './features/tercer-tiempo/index.js';
import * as asistencia from './features/asistencia/index.js';
import { initEvents } from './features/asistencia/events.js';
import { renderEventList, toggleAttAddButtonVisibility } from './features/asistencia/asistencia.svelte.js';
import { renderNextMatchBanner } from './features/partidos/partidos.svelte.js';
import { renderWellnessReminderBanner } from './features/wellness/wellness.svelte.js';
import { renderProfile } from './features/perfil/perfil.svelte.js';
import { refreshPinned } from './features/avisos/avisos.svelte.js';
import { initFantasy } from './features/fantasy/fantasy.svelte.js';
import { renderThirdTime } from './features/tercer-tiempo/tercer-tiempo.svelte.js';
import { startThirdTimeAutoFinesTimer } from './features/tercer-tiempo/auto-fines.js';

installPush();
watchSelectFocus();
registerServiceWorker();

// Los tests (y cualquier onclick="..." fuera de Svelte) cambian de sección con
// window.setSection(); setLang()/toggleLang() se dejan en window en src/lib/i18n.svelte.js.
window.setSection = setSection;

mountAt(App, 'app');

for (const feature of [galeria, test, liga, avisos, tricount, tesoreria, comiTercerTemps, gym, fantasy, multas, jugadoras, perfil, wellness, partidos, actas, tullidas, tercerTiempo, asistencia]) feature.install();

refreshSession();

// ================= ARRANQUE =================
applyI18n();

// Si ya había una sesión abierta (recarga de página), entramos directos sin pedir login
supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    onAuthenticated(data.session.user);
  }
});

// Asistencia: los entrenos de la temporada y el partido fijo contra Santboi se
// generan aquí, en el mismo momento que antes, y luego se pinta la lista.
initEvents();

renderEventList();
renderNextMatchBanner();
renderWellnessReminderBanner();
toggleAttAddButtonVisibility();
// Los botones "Añadir multa" / "Editar multas" dependen solos de la sesión.

renderProfile();

// Comi Tesoreria, Comi Tercer Temps y Tricount se pintan solas al montarse; sus datos
// no se piden aquí al arrancar (se pedían de más en TODAS las sesiones, aunque nadie
// entrara nunca en esas pestañas): setSection() los carga cada vez que se entra de
// verdad en cada una.

refreshPinned();

// Gym se pinta solo al montarse.

initFantasy();
// Tercer tiempo: primer pintado y comprobación cada minuto de las multas 3T.
renderThirdTime();
startThirdTimeAutoFinesTimer();

// Historial inicial ("Inicio") y botón "atrás" del navegador/móvil.
installHistory();
