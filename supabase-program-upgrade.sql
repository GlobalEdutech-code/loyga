-- Run once in SQL Editor on the EXISTING project. Does not delete any boats.
alter table public.loy_krathongs
 add column if not exists blocks jsonb not null default '{}'::jsonb,
 add column if not exists playback jsonb default null,
 add column if not exists speed double precision not null default 95;
alter table public.loy_krathongs drop constraint if exists loy_program_size;
alter table public.loy_krathongs add constraint loy_program_size check (
 octet_length(blocks::text) <= 250000 and
 (playback is null or octet_length(playback::text) <= 250000) and
 speed between 1 and 2000
);
notify pgrst, 'reload schema';
