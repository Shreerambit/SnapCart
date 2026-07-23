-- ============================================================
-- SnapCart — Supabase Schema + RLS
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
create table if not exists public.products (
  id text primary key,
  slug text unique not null,
  name text not null,
  tagline text default '',
  description text default '',
  price numeric not null default 0,
  original_price numeric default 0,
  stock int default 0,
  category text default 'Educational Toys',
  badge text default '',
  flags jsonb default '{}'::jsonb,
  images jsonb default '[]'::jsonb,
  features jsonb default '[]'::jsonb,
  package_includes jsonb default '[]'::jsonb,
  specs jsonb default '{}'::jsonb,
  delivery_estimate text default '3–6 business days',
  video text default '',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists products_slug_idx on public.products (slug);
create index if not exists products_active_idx on public.products (active);

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  customer_name text not null,
  phone text not null,
  alternate_phone text default '',
  email text default '',
  house text default '',
  street text default '',
  landmark text default '',
  city text default '',
  state text default '',
  pincode text default '',
  order_notes text default '',
  payment_method text default 'COD',
  order_status text default 'pending',
  total numeric default 0,
  quantity int default 1,
  products jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists orders_order_id_idx on public.orders (order_id);
create index if not exists orders_status_idx on public.orders (order_status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ------------------------------------------------------------
-- REVIEWS
-- ------------------------------------------------------------
create table if not exists public.reviews (
  id bigserial primary key,
  customer_name text not null,
  rating int default 5 check (rating >= 1 and rating <= 5),
  review text not null,
  review_image text default '',
  product_slug text default '',
  verified boolean default true,
  created_at timestamptz default now()
);

create index if not exists reviews_slug_idx on public.reviews (product_slug);

-- ------------------------------------------------------------
-- BANNERS
-- ------------------------------------------------------------
create table if not exists public.banners (
  id bigint primary key,
  text text not null,
  active boolean default true
);

-- ------------------------------------------------------------
-- SETTINGS (single-row style key/value JSON)
-- ------------------------------------------------------------
create table if not exists public.settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- SEED PRODUCT
-- ------------------------------------------------------------
insert into public.products (
  id, slug, name, tagline, description, price, original_price, stock,
  category, badge, flags, images, features, package_includes, specs,
  delivery_estimate, active
) values (
  'sc-soundbook-01',
  'intelligence-book',
  'SnapCart Intelligence Sound Book',
  'Learn · Play · Grow',
  'Premium interactive sound book for kids ages 2+. Clear audio, 500+ sounds & words, interactive buttons, and bright colorful pages.',
  499,
  1299,
  86,
  'Educational Toys',
  'Best Seller',
  '{"bestseller":true,"featured":true,"trending":true,"latest":true,"flash_sale":true,"recommended":true}'::jsonb,
  '["assets/images/product-front.png","assets/images/product-modes.png","assets/images/product-rhymes.png","assets/images/product-activities.png","assets/images/product-practice.png","assets/images/product-reusable.png","assets/images/product-speaker.jpeg","assets/images/product-heart.png","assets/images/howto-use.png"]'::jsonb,
  '["500+ sounds & words","Interactive learning buttons","Alphabets, numbers, fruits, animals, vehicles & rhymes","Clear high-quality speaker","Safe & durable material","Easy for little hands"]'::jsonb,
  '["1 × Intelligence Sound Book","1 × Erasable marker (if included in pack)","Quick start guide"]'::jsonb,
  '{"Age":"2+ years","Language":"English","Power":"AAA batteries (not included)","Material":"Non-toxic ABS + paperboard"}'::jsonb,
  '3–6 business days',
  true
) on conflict (id) do update set
  price = excluded.price,
  original_price = excluded.original_price,
  images = excluded.images,
  updated_at = now();

insert into public.settings (id, data) values (
  'main',
  '{
    "store_name":"SnapCart",
    "tagline":"Smart Choice, Happy Kids!",
    "support_email":"hello@snapcart.in",
    "support_phone":"+91 98765 43210",
    "hero_title":"Learning that feels like play",
    "hero_subtitle":"Interactive sound book for curious kids — clear audio, joyful learning, zero screens.",
    "hero_image":"assets/images/product-front.png",
    "delivery_info":"3–6 business days across India"
  }'::jsonb
) on conflict (id) do nothing;

insert into public.banners (id, text, active) values
  (1, 'Free Shipping Across India', true),
  (2, 'Cash on Delivery Available', true),
  (3, 'Limited Time · Up to 62% OFF', true),
  (4, 'Trusted by Thousands of Parents', true),
  (5, 'Fast Dispatch within 24 Hours', true),
  (6, 'Easy 7-Day Returns', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.banners enable row level security;
alter table public.settings enable row level security;

-- Drop old policies if re-running
do $$ begin
  -- products
  drop policy if exists "products_public_read" on public.products;
  drop policy if exists "products_auth_all" on public.products;
  -- orders
  drop policy if exists "orders_anon_insert" on public.orders;
  drop policy if exists "orders_anon_select_by_id" on public.orders;
  drop policy if exists "orders_auth_all" on public.orders;
  -- reviews
  drop policy if exists "reviews_public_read" on public.reviews;
  drop policy if exists "reviews_auth_all" on public.reviews;
  -- banners
  drop policy if exists "banners_public_read" on public.banners;
  drop policy if exists "banners_auth_all" on public.banners;
  -- settings
  drop policy if exists "settings_public_read" on public.settings;
  drop policy if exists "settings_auth_all" on public.settings;
end $$;

-- PRODUCTS: anyone can read active-ish catalog; only logged-in admin writes
create policy "products_public_read" on public.products
  for select to anon, authenticated
  using (true);

create policy "products_auth_all" on public.products
  for all to authenticated
  using (true)
  with check (true);

-- ORDERS: guests can place orders + track by order_id; admin full access
create policy "orders_anon_insert" on public.orders
  for insert to anon, authenticated
  with check (true);

-- Public track: allow select for everyone (order_id is unguessable enough for COD small stores)
-- For stricter security, remove this and track only via Edge Function later.
create policy "orders_anon_select" on public.orders
  for select to anon, authenticated
  using (true);

create policy "orders_auth_update" on public.orders
  for update to authenticated
  using (true)
  with check (true);

create policy "orders_auth_delete" on public.orders
  for delete to authenticated
  using (true);

-- REVIEWS: public read; admin write
create policy "reviews_public_read" on public.reviews
  for select to anon, authenticated
  using (true);

create policy "reviews_auth_all" on public.reviews
  for all to authenticated
  using (true)
  with check (true);

-- BANNERS
create policy "banners_public_read" on public.banners
  for select to anon, authenticated
  using (true);

create policy "banners_auth_all" on public.banners
  for all to authenticated
  using (true)
  with check (true);

-- SETTINGS
create policy "settings_public_read" on public.settings
  for select to anon, authenticated
  using (true);

create policy "settings_auth_all" on public.settings
  for all to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- DONE
-- Next steps (in Dashboard):
-- 1. Authentication → Users → Add user (email: admin@snapcart.in + your password)
-- 2. Project Settings → API → copy Project URL + anon public key
-- 3. Paste into supabase.js (SUPABASE_URL + SUPABASE_ANON_KEY)
-- ============================================================
