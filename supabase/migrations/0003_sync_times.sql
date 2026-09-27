-- Sync (step 6) asks for "rows changed since I last looked". That only works if every row's
-- updated_at comes from one clock, so the database sets it on every write rather than trusting the
-- phone (a phone that was offline for a day would otherwise push changes stamped a day ago, and
-- another phone that had already looked past that time would never see them).
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger wines_touch before insert or update on public.wines
  for each row execute function public.touch_updated_at();
create trigger user_docs_touch before insert or update on public.user_docs
  for each row execute function public.touch_updated_at();
