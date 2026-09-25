<script>
  // Ventana modal con el mismo marcado que las del código antiguo (.modal-overlay /
  // .modal-box). El botón "atrás" del móvil (js/main.js) cierra cualquier modal
  // abierto quitándole la clase "active" y lanzando "modal:close"; aquí se escucha
  // ese evento para que `open` no se quede desincronizado.
  let { open = $bindable(false), id, boxStyle = '', children } = $props();
  let overlay;

  $effect(() => {
    const onClose = () => { open = false; };
    overlay.addEventListener('modal:close', onClose);
    return () => overlay.removeEventListener('modal:close', onClose);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="modal-overlay"
  class:active={open}
  {id}
  bind:this={overlay}
  onclick={(e) => { if (e.target === e.currentTarget) open = false; }}
>
  <div class="modal-box" style={boxStyle}>
    {@render children()}
  </div>
</div>
