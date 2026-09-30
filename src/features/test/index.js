import { mountAt, mountInto } from '../../lib/mount.js';
import Test from './Test.svelte';
import TestRankingModal from './TestRankingModal.svelte';

export function install() {
  mountInto(Test, '#sec-test');
  mountAt(TestRankingModal, 'test-ranking-modal');
}
