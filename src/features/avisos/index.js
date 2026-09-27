import { mountAt, mountInto } from '../../lib/mount.js';
import NoticesCard from './NoticesCard.svelte';
import TopNotices from './TopNotices.svelte';
import AddNoticeModal from './AddNoticeModal.svelte';

export function install() {
  mountAt(NoticesCard, 'inicio-notices-card');
  mountInto(TopNotices, '#inicio-top-notices');
  mountAt(AddNoticeModal, 'add-notice-modal');
}
