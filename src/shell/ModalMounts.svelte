<script>
  // Sitio de cada modal: cada sección monta el suyo en su <div data-mount>, en este
  // mismo orden (que es el que tenían en index.html).
</script>

<!-- MODAL: EDITAR PERFIL (src/features/perfil/EditProfileModal.svelte) -->
<div data-mount="edit-profile-modal"></div>

<!-- MODAL: AJUSTAR/RECORTAR LA FOTO DE PERFIL (src/features/perfil/AvatarAdjustModal.svelte) -->
<div data-mount="avatar-adjust-modal"></div>

<!-- MODAL: AÑADIR MOVIMIENTO DE COMI TERCER TEMPS -->
<div data-mount="add-tercer-treasury-modal"></div>

<!-- MODAL: DESGLOSE DEL SALDO POR INTEGRANTE DE COMI TERCER TEMPS -->
<div data-mount="tercer-treasury-breakdown-modal"></div>

<!-- MODAL: LISTA COMPLETA DE JUGADORAS DE UNA ALERTA DE WELLNESS (molestias / mal descanso / carga alta) -->
<div data-mount="wstaff-alert-modal"></div>

<!-- MODAL: HISTORIAL COMPLETO DE CARGA (sRPE) DE UNA JUGADORA -->
<div data-mount="wstaff-player-history-modal"></div>

<!-- MODAL: CONFIRMAR ELIMINAR MOVIMIENTO DE COMI TERCER TEMPS -->
<div data-mount="delete-tercer-treasury-confirm-modal"></div>

<!-- MODAL: AÑADIR MOVIMIENTO DE TESORERÍA -->
<div data-mount="add-treasury-modal"></div>

<!-- MODAL: AÑADIR AVISO -->
<div data-mount="add-notice-modal"></div>

<!-- MODAL: REGISTRAR MARCA (1RM) -->
<div data-mount="gym-rm-modal"></div>

<!-- MODAL: HISTÓRICO DE MARCAS DE UN EJERCICIO -->
<div data-mount="gym-rm-history-modal"></div>

<!-- MODAL: APUNTARME AL GYM HOY -->
<div data-mount="gym-checkin-modal"></div>

<!-- MODAL: SUBIR PDF DE LA RUTINA SEMANAL -->
<div data-mount="gym-routine-upload-modal"></div>

<!-- MODAL: RANKING DEL TEST -->
<div data-mount="test-ranking-modal"></div>

<!-- MODAL: SUBIR PDF DEL ACTA DEL PARTIDO -->
<div data-mount="match-report-upload-modal"></div>

<!-- TULLIDAS: lista de jugadoras apuntadas para vendaje antes de un partido -->
<div data-mount="tullides-modal"></div>

<!-- WELLNESS / RPE: valoración de dos fases (esfuerzo percibido + molestias físicas),
     visible y accesible SOLO para el rol jugadora (ver canUseWellness en src/lib/permissions.js) -->
<div data-mount="wellness-modal"></div>


<!-- MODAL: CREAR/EDITAR ACTA A MANO -->
<div data-mount="match-report-builder-modal"></div>


<!-- MODAL: DESGLOSE DEL SALDO POR INTEGRANTE DE LA COMISIÓN -->
<div data-mount="treasury-breakdown-modal"></div>

<!-- MODAL DE COMENTARIO / JUSTIFICACIÓN -->
<div data-mount="food-slot-modal"></div>

<div data-mount="tt-group-modal"></div>

<!-- MODAL: GRUPOS DEL TERCER TIEMPO (integrantes de cada grupo, sin ligar a un partido) -->
<div data-mount="tt-groups-overview-modal"></div>

<!-- MODAL: RECUERDA (qué llevar al partido) -->
<div data-mount="matchday-checklist-modal"></div>

<!-- MODAL: LISTA (pasar lista en convocatoria) -->
<div data-mount="rollcall-modal"></div>

<!-- MODAL: NO PUEDO ASISTIR (cambio de turno del tercer tiempo) -->
<div data-mount="swap-modal"></div>

<div data-mount="comment-modal"></div>

<!-- MODAL DE ALTA DE MULTA -->
<div data-mount="fine-modal"></div>

<!-- MODAL DE EDICIÓN DE MULTA -->
<div data-mount="edit-fine-modal"></div>

<!-- MODAL: PAGAR MULTA -->
<div data-mount="pay-fine-modal"></div>

<!-- HISTÓRICO DE MULTAS PAGADAS -->
<div data-mount="fines-history-modal"></div>

<!-- MODAL DE CALENDARIO -->
<div data-mount="calendar-modal"></div>

<!-- POPOVER DE DETALLE DE UN EVENTO DEL CALENDARIO -->
<div data-mount="event-info-modal"></div>

<!-- MODAL: FILTRAR LA LISTA DE ASISTENCIA POR TIPO DE EVENTO -->
<div data-mount="att-filter-modal"></div>

<!-- MODAL: ELEGIR TIPO DE EVENTO A AÑADIR (preconfiguraciones) -->
<div data-mount="att-add-type-modal"></div>

<!-- MODAL PARA AÑADIR UN EVENTO (entreno, partido o reunión, según preconfiguración elegida) -->
<div data-mount="add-event-modal"></div>
<!-- MODAL: CONFIRMAR ELIMINAR EVENTO -->
<div data-mount="delete-event-confirm-modal"></div>

<!-- MODAL: CONFIRMAR ELIMINAR MOVIMIENTO DE TESORERÍA -->
<div data-mount="delete-treasury-confirm-modal"></div>

<!-- MODAL: GUARDAR ALINEACIÓN -->
<div data-mount="save-lineup-modal"></div>

<!-- MODAL: PUBLICAR ALINEACIÓN -->
<div data-mount="publish-modal"></div>

<!-- MODAL: ALINEACIONES COMPARTIDAS CONTIGO -->
<div data-mount="shared-lineups-modal"></div>

<!-- MODAL: AÑADIR ÁLBUM DE GALERÍA -->
<div data-mount="add-album-modal"></div>

<!-- MODAL: VER UNA JUGADA -->
<div data-mount="play-modal"></div>

<!-- MODAL: AÑADIR UNA JUGADA (solo admins) -->
<div data-mount="add-play-modal"></div>

<!-- PIZARRA DEL EDITOR DE JUGADAS, A PANTALLA COMPLETA (solo admins) -->
<div data-mount="play-board-full"></div>

<!-- MODAL: CONFIRMAR ELIMINAR UNA JUGADA (solo admins) -->
<div data-mount="delete-play-modal"></div>
