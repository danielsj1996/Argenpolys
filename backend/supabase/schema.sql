create table if not exists public.match_history (
    id bigint generated always as identity primary key,
    match_id uuid not null,
    user_id uuid references auth.users (id) on delete set null,
    room_code text not null,
    player_name text not null,
    winner_name text not null,
    won boolean not null,
    reason text not null,
    player_count smallint not null check (player_count between 1 and 8),
    duration_seconds integer not null check (duration_seconds >= 0),
    finished_at timestamptz not null
);

create index if not exists match_history_user_finished_idx
    on public.match_history (user_id, finished_at desc);

alter table public.match_history enable row level security;

drop policy if exists "Users can read their own match history"
    on public.match_history;

create policy "Users can read their own match history"
    on public.match_history
    for select
    to authenticated
    using (auth.uid() = user_id);
