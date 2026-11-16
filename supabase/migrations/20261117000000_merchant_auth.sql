-- Merchant accounts (Supabase Auth) and row-level security.
-- Run once in the Supabase dashboard: SQL Editor → paste → Run. Safe to re-run.
--
-- Model: each Supabase Auth user is one merchant, and merchants.id = auth.users.id.

-- 1. Create the merchants row automatically when someone signs up.
--    The business name comes from the sign-up form (user metadata), falling back to the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.merchants (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this migration ran never got a merchants row; add them now.
insert into public.merchants (id, name)
select u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'business_name'), ''), u.email)
from auth.users u
on conflict (id) do nothing;

-- 2. workflows belong to a merchant. New rows default to the logged-in user,
--    so the browser never has to (or gets to) choose the merchant_id.
alter table public.workflows alter column merchant_id set default auth.uid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workflows_merchant_id_fkey') then
    alter table public.workflows
      add constraint workflows_merchant_id_fkey
      foreign key (merchant_id) references public.merchants (id) on delete cascade;
  end if;
end $$;

create index if not exists workflows_merchant_created_idx on public.workflows (merchant_id, created_at desc);

-- 3. Row-level security for tables the browser reads directly.
--    `(select auth.uid())` is evaluated once per query instead of once per row.
alter table public.merchants enable row level security;

drop policy if exists "merchants: read own" on public.merchants;
create policy "merchants: read own" on public.merchants
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "merchants: update own" on public.merchants;
create policy "merchants: update own" on public.merchants
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter table public.workflows enable row level security;

drop policy if exists "workflows: own rows" on public.workflows;
create policy "workflows: own rows" on public.workflows
  for all to authenticated
  using (merchant_id = (select auth.uid()))
  with check (merchant_id = (select auth.uid()));

-- rubrics and quote_assessments already have RLS with no policies (see the quote
-- engine migration): only the backend's service key can access them, and the
-- backend scopes every query to the merchant from the caller's login token.

notify pgrst, 'reload schema';
