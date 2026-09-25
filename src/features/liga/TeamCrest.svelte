<script>
  import { crestFor } from './liga.js';

  let { name } = $props();
  const c = $derived(crestFor(name));
  // Si el logo no carga, se muestran las iniciales en su lugar.
  let failed = $state(false);
</script>

{#if c.logo}
  <span class="liga-crest" style="background: transparent; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;" title={name}>
    <img src={c.logo} alt={name} loading="lazy" style="width: 100%; height: 100%; object-fit: contain; display: {failed ? 'none' : 'block'};" onerror={() => (failed = true)} />
    <span style="display: {failed ? 'inline-flex' : 'none'}; width: 100%; height: 100%; align-items: center; justify-content: center; background: {c.bg || '#444'}; border-radius: 4px;">{c.initials}</span>
  </span>
{:else}
  <span class="liga-crest" style="background:{c.bg};" title={name}>{c.initials}</span>
{/if}
