/* ================= SUPABASE =================
   Cliente único de Supabase para toda la app. supabase-js va empaquetado con la app
   (antes se cargaba del CDN con un <script> en index.html): así no depende de otro
   servidor al arrancar y la app abre también sin conexión, desde la caché del service
   worker. */
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://tpbuxspqibwitqzstdcz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IsSxJZuY-PBx5VlUWaANGg_84s8krAq';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
