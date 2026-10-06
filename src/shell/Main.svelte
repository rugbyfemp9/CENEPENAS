<script>
  // Zona principal: una <section id="sec-..."> por pantalla. Las vacías las rellena
  // cada sección al montarse (src/features/*/index.js); la activa la dice `nav`.
  import Inicio from './Inicio.svelte';
  import Vestuario from './Vestuario.svelte';
  import Comisiones from './Comisiones.svelte';
  import ComiStatic from './ComiStatic.svelte';
  import { nav } from './navigation.svelte.js';
</script>

<main class="main">

  <!-- INICIO -->
  <Inicio />

  <!-- ASISTENCIA -->
  <section class="section" class:active={nav.current === 'asistencia'} id="sec-asistencia"></section>

  <!-- ASISTENCIA — DETALLE DE UN EVENTO -->
  <section class="section" class:active={nav.current === 'asistencia-detalle'} id="sec-asistencia-detalle"></section>

  <!-- VESTUARIO (hub — punto de entrada en móvil a multas / tercer tiempo / jugadores / calendario) -->
  <Vestuario />

  <!-- WELLNESS / RPE — COS TÈCNIC: vista d'anàlisi agregada de tot l'equip per a un
       entrenament concret. Només visible per a rols de gestió (entrenador/a, delegado/a,
       directiva, fisio, admin) — ver STAFF_WELLNESS_ROLES / canViewWellnessStaff() y
       toggleWellnessStaffCardVisibility(). Ni la pestanya de "Vestuario" ni el botón del
       sidebar aparecen para el resto de roles (p.ej. jugadora), y setSection() redirige
       igualmente si alguien intenta entrar a mano. -->
  <!-- Percepción del esfuerzo: lo pinta Svelte (src/features/wellness/WellnessStaff.svelte) -->
  <section class="section" class:active={nav.current === 'wellness-staff'} id="sec-wellness-staff"></section>

  <!-- TEST (sección de pruebas) -->
  <!-- Test: lo pinta Svelte (src/features/test/Test.svelte) -->
  <section class="section" class:active={nav.current === 'test'} id="sec-test"></section>

  <!-- PARTIDOS -->
  <section class="section" class:active={nav.current === 'partidos'} id="sec-partidos"></section>

  <!-- PARTIDO: DETALLE -->
  <section class="section" class:active={nav.current === 'partido-detalle'} id="sec-partido-detalle"></section>

  <!-- GYM -->
  <section class="section" class:active={nav.current === 'gym'} id="sec-gym"></section>

  <!-- GYM: MI ENTRENAMIENTO (pantalla completa propia) -->
  <section class="section" class:active={nav.current === 'gym-entrenamiento'} id="sec-gym-entrenamiento"></section>

  <!-- GYM: MI ENTRENAMIENTO — DETALLE DE UN DÍA -->
  <section class="section" class:active={nav.current === 'gym-entrenamiento-dia'} id="sec-gym-entrenamiento-dia"></section>

  <!-- GYM: EQUIPO (pantalla completa propia) -->
  <section class="section" class:active={nav.current === 'gym-equipo'} id="sec-gym-equipo"></section>

  <!-- COMISIONES -->
  <Comisiones />

  <!-- COMI ACTIVITATS -->
  <ComiStatic id="comi-activitats" title="Comi Activitats" />

  <!-- COMI XARXES -->
  <ComiStatic id="comi-xarxes" title="Comi Xarxes" />

  <!-- Comi Tercer Temps: la pinta Svelte (src/features/comi-tercer-temps/ComiTercerTemps.svelte) -->
  <section class="section" class:active={nav.current === 'comi-tercer-temps'} id="sec-comi-tercer-temps"></section>

  <!-- Comi Tesoreria: la pinta Svelte (src/features/tesoreria/Tesoreria.svelte) -->
  <section class="section" class:active={nav.current === 'comi-tesoreria'} id="sec-comi-tesoreria"></section>

  <!-- COMI GIRA -->
  <ComiStatic id="comi-gira" title="Comi Gira" />

  <!-- MULTAS -->
  <!-- Multas: la pinta Svelte (src/features/multas/Multas.svelte) -->
  <section class="section" class:active={nav.current === 'multas'} id="sec-multas"></section>

  <!-- Tricount: lo pinta Svelte (src/features/tricount/Tricount.svelte) -->
  <section class="section" class:active={nav.current === 'tricount'} id="sec-tricount"></section>

  <!-- MODAL: AÑADIR GASTO TRICOUNT -->
  <div data-mount="add-tricount-modal"></div>

  <!-- LIGA -->
  <!-- Liga: la pinta Svelte (src/features/liga/Liga.svelte) -->
  <section class="section" class:active={nav.current === 'liga'} id="sec-liga"></section>

  <!-- TERCER TIEMPO — LISTA DE PARTIDOS: la pinta Svelte (src/features/tercer-tiempo/TercerList.svelte) -->
  <section class="section" class:active={nav.current === 'tercer'} id="sec-tercer"></section>

  <!-- TERCER TIEMPO — HISTÓRICO DE PARTIDOS PASADOS: lo pinta Svelte (src/features/tercer-tiempo/TercerHistorial.svelte) -->
  <section class="section" class:active={nav.current === 'tercer-historial'} id="sec-tercer-historial"></section>

  <!-- TERCER TIEMPO — DETALLE DE UN PARTIDO: lo pinta Svelte (src/features/tercer-tiempo/TercerDetalle.svelte) -->
  <section class="section" class:active={nav.current === 'tercer-detalle'} id="sec-tercer-detalle"></section>

  <!-- JUGADORES -->
  <section class="section" class:active={nav.current === 'plantilla'} id="sec-plantilla"></section>

  <!-- FANTASY -->
  <!-- Fantasy: la pinta Svelte (src/features/fantasy/Fantasy.svelte) -->
  <section class="section" class:active={nav.current === 'fantasy'} id="sec-fantasy"></section>

  <!-- JUGADAS: las pinta Svelte (src/features/jugadas/Jugadas.svelte) -->
  <section class="section" class:active={nav.current === 'jugadas'} id="sec-jugadas"></section>

  <!-- JUGADAS — EDITOR DE PIZARRA (solo admins): src/features/jugadas/PlayEditor.svelte -->
  <section class="section" class:active={nav.current === 'jugada-editor'} id="sec-jugada-editor"></section>

  <!-- GALERÍA -->
  <!-- Galería: la pinta Svelte (src/features/galeria/Galeria.svelte) -->
  <section class="section" class:active={nav.current === 'galeria'} id="sec-galeria"></section>

  <!-- PERFIL DE USUARIO: lo pinta Svelte (src/features/perfil/Perfil.svelte) -->
  <section class="section" class:active={nav.current === 'perfil'} id="sec-perfil"></section>
</main>
