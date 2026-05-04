alter table public.users
add column if not exists show_in_stats boolean not null default true;
