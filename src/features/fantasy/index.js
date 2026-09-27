import { mountAt, mountInto } from '../../lib/mount.js';
import Fantasy from './Fantasy.svelte';
import SaveLineupModal from './SaveLineupModal.svelte';
import PublishModal from './PublishModal.svelte';
import SharedLineupsModal from './SharedLineupsModal.svelte';
import SharedLineupBanner from './SharedLineupBanner.svelte';

export function install() {
  mountAt(SharedLineupBanner, 'inicio-shared-lineup-banner');
  mountInto(Fantasy, '#sec-fantasy');
  mountAt(SaveLineupModal, 'save-lineup-modal');
  mountAt(PublishModal, 'publish-modal');
  mountAt(SharedLineupsModal, 'shared-lineups-modal');
}
