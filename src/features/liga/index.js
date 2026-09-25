import { mountInto } from '../../lib/mount.js';
import { mount } from 'svelte';
import Liga from './Liga.svelte';
import LeaguePosition from './LeaguePosition.svelte';

export function install() {
  mountInto(Liga, '#sec-liga');
  // El banner de Liga de Inicio sigue en index.html; solo su número sale de aquí.
  const num = document.getElementById('league-position-num');
  num.textContent = '';
  mount(LeaguePosition, { target: num });
}
