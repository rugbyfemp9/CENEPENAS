/* ================= SUPABASE =================
   Cliente único de Supabase para toda la app. Se crea con el supabase-js que carga
   el <script> del CDN en index.html (window.supabase), que ya está disponible antes
   que cualquier módulo. */
export const SUPABASE_URL = 'https://tpbuxspqibwitqzstdcz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IsSxJZuY-PBx5VlUWaANGg_84s8krAq';
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
