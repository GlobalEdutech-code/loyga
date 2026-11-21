-- Per-boat leaderboard. Old loy_scores and its history are preserved.
create table if not exists public.loy_boat_scores (
 owner_id uuid not null references auth.users(id) on delete cascade,
 boat_id uuid not null,
 player_name text not null check (char_length(player_name) between 1 and 60),
 score bigint not null default 0 check(score>=0),
 updated_at timestamptz not null default now(),
 primary key(owner_id,boat_id)
);
create table if not exists public.loy_boat_score_events (
 owner_id uuid not null references auth.users(id) on delete cascade,
 boat_id uuid not null,
 event_id uuid not null,
 primary key(owner_id,boat_id,event_id)
);
alter table public.loy_boat_scores enable row level security;
alter table public.loy_boat_score_events enable row level security;
revoke all on public.loy_boat_scores,public.loy_boat_score_events from anon,authenticated;
grant select on public.loy_boat_scores to anon,authenticated;
drop policy if exists "Public boat scores" on public.loy_boat_scores;
create policy "Public boat scores" on public.loy_boat_scores for select to anon,authenticated using(true);
create or replace function public.loy_add_boat_score(p_boat uuid,p_event uuid,p_name text,p_points integer)
returns bigint language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); added integer; total bigint;
begin
 if who is null then raise exception 'Sign in first';end if;
 if p_boat is null or p_event is null or p_name is null or char_length(trim(p_name)) not between 1 and 60 or p_points is null or p_points not between 0 and 5 then raise exception 'Invalid score event';end if;
 insert into public.loy_boat_scores(owner_id,boat_id,player_name) values(who,p_boat,trim(p_name))
 on conflict(owner_id,boat_id) do update set player_name=excluded.player_name;
 if p_points>0 then
  insert into public.loy_boat_score_events(owner_id,boat_id,event_id) values(who,p_boat,p_event) on conflict do nothing;
  get diagnostics added=row_count;
  if added>0 then update public.loy_boat_scores set score=score+p_points,updated_at=now() where owner_id=who and boat_id=p_boat;end if;
 end if;
 select score into total from public.loy_boat_scores where owner_id=who and boat_id=p_boat;
 return total;
end;
$$;
revoke all on function public.loy_add_boat_score(uuid,uuid,text,integer) from public;
grant execute on function public.loy_add_boat_score(uuid,uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
