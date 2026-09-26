// Punto de entrada de la parte en Svelte.
//
// La app se está migrando a Svelte sección a sección. Mientras tanto conviven dos
// mundos: el código antiguo (js/, <script> clásicos que index.html carga antes)
// y los componentes de src/. Este archivo, que se ejecuta después de todos ellos:
//   1. monta las secciones ya migradas y registra lo que el código antiguo puede
//      llamar de ellas en window.appBridge;
//   2. arranca el código antiguo con legacyBoot() (js/main.js).
import { appBridge } from './lib/bridge.js';
import { refreshSession } from './lib/session.svelte.js';
import * as galeria from './features/galeria/index.js';
import * as test from './features/test/index.js';
import * as liga from './features/liga/index.js';
import * as avisos from './features/avisos/index.js';
import * as tricount from './features/tricount/index.js';
import * as tesoreria from './features/tesoreria/index.js';
import * as comiTercerTemps from './features/comi-tercer-temps/index.js';
import * as gym from './features/gym/index.js';
import * as fantasy from './features/fantasy/index.js';

for (const feature of [galeria, test, liga, avisos, tricount, tesoreria, comiTercerTemps, gym, fantasy]) feature.install(appBridge);

refreshSession();
window.legacyBoot();
