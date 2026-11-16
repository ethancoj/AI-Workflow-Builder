-- One-off: move the data saved before login existed (owned by the placeholder
-- merchant 00000000-…) into a real account.
-- Run in SQL Editor AFTER that account has signed up. Replace the email first.

do $$
declare
  placeholder constant uuid := '00000000-0000-0000-0000-000000000000';
  target uuid;
begin
  select id into target from auth.users where email = 'you@example.com';
  if target is null then
    raise exception 'No account with that email. Sign up in the app first.';
  end if;

  update public.workflows         set merchant_id = target where merchant_id = placeholder;
  update public.rubrics           set merchant_id = target where merchant_id = placeholder;
  update public.quote_assessments set merchant_id = target where merchant_id = placeholder;

  raise notice 'Moved placeholder data to %', target;
end $$;
