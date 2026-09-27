import { mountAt, mountInto } from '../../lib/mount.js';
import AsistenciaList from './AsistenciaList.svelte';
import AsistenciaDetalle from './AsistenciaDetalle.svelte';
import CommentModal from './CommentModal.svelte';
import CalendarModal from './CalendarModal.svelte';
import EventPopover from './EventPopover.svelte';
import AttFilterModal from './AttFilterModal.svelte';
import AddTypeModal from './AddTypeModal.svelte';
import AddEventModal from './AddEventModal.svelte';
import DeleteEventModal from './DeleteEventModal.svelte';
import { onLangChange } from './asistencia.svelte.js';
import { onCommentModalLangChange } from './attendance.svelte.js';
import { onCalendarLangChange } from './calendar.svelte.js';
import { onEditorLangChange } from './editor.svelte.js';

export function install() {
  mountInto(AsistenciaList, '#sec-asistencia');
  mountInto(AsistenciaDetalle, '#sec-asistencia-detalle');
  mountAt(CommentModal, 'comment-modal');
  mountAt(CalendarModal, 'calendar-modal');
  mountAt(EventPopover, 'event-info-modal');
  mountAt(AttFilterModal, 'att-filter-modal');
  mountAt(AddTypeModal, 'att-add-type-modal');
  mountAt(AddEventModal, 'add-event-modal');
  mountAt(DeleteEventModal, 'delete-event-confirm-modal');

  // Antes setLang() (js/core/i18n.js) volvía a pintar la lista, el detalle abierto, la
  // cuadrícula del calendario y el subtítulo del modal de comentario (y applyI18n()
  // devolvía algunos títulos a su texto por defecto): se sigue haciendo igual.
  window.addEventListener('app:langchange', () => {
    onEditorLangChange();
    onLangChange();
    onCalendarLangChange();
    onCommentModalLangChange();
  });
}
