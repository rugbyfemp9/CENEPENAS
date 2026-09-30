<script>
  // Una persona en las listas del detalle de un evento (con su comentario, y el botón
  // para comentar solo en la propia fila).
  import Avatar from '../../lib/Avatar.svelte';
  import { openCommentModal } from './attendance.svelte.js';

  let { row } = $props();
</script>

<div class="att-roster-row">
  <div class="avatar"><Avatar url={row.avatarUrl} fallback={row.initials} injured={row.injured} injuryIcon={row.injuryIcon} /></div>
  <div class="meta">
    <b>{row.name}</b>
    {#if row.comment}<span class="comment">{row.comment}</span>{/if}
  </div>
  {#if row.commentBtn}<button class="att-comment-btn" onclick={() => openCommentModal(row.eventId, row.id)}>{row.commentBtn}</button>{/if}
</div>
