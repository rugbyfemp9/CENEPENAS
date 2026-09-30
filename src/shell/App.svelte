<script>
  // Armazón de la app: acceso, barra superior de móvil, sidebar, las secciones, el
  // sitio de cada modal y la nav inferior de móvil, en el mismo orden que tenían en
  // index.html. Lo monta src/main.js antes que las secciones (que se montan dentro).
  import AuthOverlay from './AuthOverlay.svelte';
  import TopBar from './TopBar.svelte';
  import Sidebar from './Sidebar.svelte';
  import Main from './Main.svelte';
  import ModalMounts from './ModalMounts.svelte';
  import BottomNav from './BottomNav.svelte';
</script>

<!-- LOGIN / REGISTRO (Supabase Auth) -->
<AuthOverlay />

<!-- BARRA SUPERIOR — solo visible en móvil -->
<TopBar />

<div class="app">
  <Sidebar />

  <Main />
</div>

<ModalMounts />

<!-- NAV INFERIOR — solo visible en móvil -->
<BottomNav />
