alter table public.task_updates
add column if not exists progress_percentage numeric(5,2)
check (progress_percentage is null or (progress_percentage >= 0 and progress_percentage <= 100));
