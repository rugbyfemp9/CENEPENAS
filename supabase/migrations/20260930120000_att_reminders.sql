-- Recordatorios de asistencia por notificación push (supabase/functions/training-reminders).
--
-- Antes de aplicar esta migración hay que guardar en Vault la URL de la función y el
-- secreto que la protege (ver README → "Recordatoris d'assistència"):
--   select vault.create_secret('https://<proyecto>.supabase.co/functions/v1/training-reminders', 'reminders_url');
--   select vault.create_secret('<el mismo valor que REMINDERS_CRON_SECRET>', 'reminders_secret');

-- A quién se ha avisado ya de cada evento, para no repetir el aviso. Solo la usa la
-- función (con la service role): RLS activado y sin políticas = nadie más la ve.
create table if not exists public.att_reminders_sent (
  event_id text not null,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.att_reminders_sent enable row level security;

-- pg_cron (el temporizador) y pg_net (para que el temporizador llame a la función).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Cada 15 minutos. La función avisa de lo que empieza en las próximas 24 h, así que cada
-- aviso sale entre 24 h y 23 h 45 min antes (o en cuanto se crea el evento, si es más tarde).
select cron.schedule(
  'att-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
