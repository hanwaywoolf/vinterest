-- Partner shops' products, from their Awin product feeds, so a wine's Price tab can show the very
-- bottle with a "Buy at <shop>" link (the Worker's POST /shop-match, handleShopMatch). The nightly
-- job (scripts/shop-feeds.mjs, .github/workflows/shop-feeds.yml) replaces each shop's rows with
-- the secret key; the Worker reads them with its own. Nobody else can read or write them: they're
-- the shop's catalogue, not user data (row-level security on, no policy for anon or authenticated).
create table public.shop_products (
  shop       text not null,                 -- data/retailers.json id, e.g. 'winebuyers'
  product_id text not null,                 -- the feed's aw_product_id
  name       text not null,                 -- as the shop lists it, the seller suffix removed
  words      text[] not null,               -- the name's words, lower-case without accents (matching)
  vintage    int check (vintage between 1800 and 2100),
  size_ml    int,                           -- 750 unless the name says otherwise
  pack       int not null default 1 check (pack >= 1),   -- bottles in the listing (a case of 6 is 6)
  price      numeric(10,2) not null check (price >= 0),  -- for the whole listing
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  url        text not null,                 -- the shop's own page (the Worker's /go adds the tracking)
  image      text,
  seller     text,                          -- a marketplace's seller, when the listing names one
  seen_at    timestamptz not null default now(),
  primary key (shop, product_id)
);
create index shop_products_words on public.shop_products using gin (words);

alter table public.shop_products enable row level security;
revoke all on public.shop_products from anon, authenticated;
grant select, insert, update, delete on public.shop_products to service_role;

-- The listings sharing most words with a wine's name, for the Worker to score (it decides the match).
create function public.shop_candidates(p_shop text, p_words text[], p_limit int default 40)
returns setof public.shop_products language sql stable as $$
  select p.* from public.shop_products p
  where p.shop = p_shop and p.words && p_words
  order by (select count(*) from unnest(p.words) w where w = any(p_words)) desc, p.pack, p.price
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;
revoke all on function public.shop_candidates(text, text[], int) from public, anon, authenticated;
grant execute on function public.shop_candidates(text, text[], int) to service_role;
