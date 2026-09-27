<script>
  // Asistencia — detalle de un evento: cabecera y pestañas Asistirán / No asistirán / Sin contestar.
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { attDetail, getDetailView, setAttTab } from './asistencia.svelte.js';
  import DetailHeader from './DetailHeader.svelte';
  import RosterRow from './RosterRow.svelte';
  import RosterGroup from './RosterGroup.svelte';

  const v = $derived(getDetailView());
</script>

{#snippet rows(list)}
  {#if list.length}
    {#each list as row}<RosterRow {row} />{/each}
  {:else}
    <div class="att-roster-empty">{v.nobodyYet}</div>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('asistencia')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.asistencia')}</span></div>

<DetailHeader />

<div class="att-tabs">
  <button data-att-tab="yes" class:active={attDetail.tab === 'yes'} onclick={() => setAttTab('yes')}><span>{t('att.willAttend')}</span> <span class="count" id="att-count-yes">{v ? v.counts.yes : 0}</span></button>
  <button data-att-tab="no" class:active={attDetail.tab === 'no'} onclick={() => setAttTab('no')}><span>{t('att.willNotAttend')}</span> <span class="count" id="att-count-no">{v ? v.counts.no : 0}</span></button>
  <button data-att-tab="pending" class:active={attDetail.tab === 'pending'} onclick={() => setAttTab('pending')}><span>{t('att.noAnswer')}</span> <span class="count" id="att-count-pending">{v ? v.counts.pending : 0}</span></button>
</div>
<div class="att-roster" data-att-roster="yes" class:active={attDetail.tab === 'yes'}><div class="att-roster-list" id="att-roster-yes">
  {#if v}
    {#if v.yes}
      {#if v.yes.jugadoras}
        <div class="att-roster-group">
          <div class="att-roster-group-title">{v.yes.jugadoras.label} <span class="count">{v.yes.jugadoras.count}</span></div>
          {#each v.yes.jugadoras.subgroups as group}<RosterGroup {group} isSubgroup />{/each}
        </div>
      {/if}
      {#each v.yes.roles as group}<RosterGroup {group} />{/each}
    {:else}
      <div class="att-roster-empty">{v.nobodyYet}</div>
    {/if}
  {/if}
</div></div>
<div class="att-roster" data-att-roster="no" class:active={attDetail.tab === 'no'}><div class="att-roster-list" id="att-roster-no">{#if v}{@render rows(v.no)}{/if}</div></div>
<div class="att-roster" data-att-roster="pending" class:active={attDetail.tab === 'pending'}><div class="att-roster-list" id="att-roster-pending">{#if v}{@render rows(v.pending)}{/if}</div></div>
