-- Run once in the Supabase SQL Editor of a NEW project.
create table public.loy_krathongs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 room text not null default 'loy-main' check (char_length(room) between 1 and 80),
 name text not null check (char_length(name) between 1 and 60),
 image text not null check (char_length(image) < 300000 and image ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'),
 x double precision not null check (x between -10000 and 10000),
 y double precision not null check (y between -10000 and 10000),
 angle double precision not null check (angle between -360 and 360),
 released boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index loy_krathongs_room_created on public.loy_krathongs(room,created_at,id);
alter table public.loy_krathongs enable row level security;
grant select on public.loy_krathongs to anon, authenticated;
grant insert, update, delete on public.loy_krathongs to authenticated;
create policy "Public river is readable" on public.loy_krathongs for select to anon, authenticated using (true);
create policy "Create only own boats" on public.loy_krathongs for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update only own boats" on public.loy_krathongs for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete only own boats" on public.loy_krathongs for delete to authenticated using ((select auth.uid()) = owner_id);
create function public.loy_stamp_update() returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.room := old.room;
 else
  new.created_at := now();
 end if;
 new.updated_at := now();
 return new;
end;
$$;
create trigger loy_stamp_update before insert or update on public.loy_krathongs for each row execute function public.loy_stamp_update();
