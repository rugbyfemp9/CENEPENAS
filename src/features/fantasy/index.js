import { mountAt, mountInto } from '../../lib/mount.js';
import Fantasy from './Fantasy.svelte';
import SaveLineupModal from './SaveLineupModal.svelte';
import PublishModal from './PublishModal.svelte';
import SharedLineupsModal from './SharedLineupsModal.svelte';
import SharedLineupBanner from './SharedLineupBanner.svelte';
import { initFantasy, loadAfterLogin, refreshFantasyMatchesAndUI, checkInicioSharedLineupBanner } from './fantasy.svelte.js';

export function install(bridge) {
  mountAt(SharedLineupBanner, 'inicio-shared-lineup-banner');
  mountInto(Fantasy, '#sec-fantasy');
  mountAt(SaveLineupModal, 'save-lineup-modal');
  mountAt(PublishModal, 'publish-modal');
  mountAt(SharedLineupsModal, 'shared-lineups-modal');

  bridge.fantasy = {
    // Al arrancar (legacyBoot) y tras crear/editar/eliminar un evento (eventos.js):
    // recupera el borrador local y vuelve a pintar partidos, campo y banquillo.
    init: initFantasy,
    // Al iniciar sesión (auth.js): borrador de esta persona, partidos/banquillo y el
    // aviso de Inicio de alineaciones compartidas.
    loadAfterLogin,
    // Al entrar en Fantasy (setSection) o cuando llega la Plantilla estando en Fantasy
    // (jugadoras.js): el desplegable y el banquillo se releen de los partidos, sus
    // respuestas y el roster del código antiguo.
    refresh: refreshFantasyMatchesAndUI,
    // Al entrar en Inicio (setSection).
    checkInicioSharedLineupBanner,
  };
}
