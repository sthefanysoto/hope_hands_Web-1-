-- ============================================================================
-- HOPE HANDS · ESQUEMA DE BASE DE DATOS (SUPABASE / POSTGRES)
-- ============================================================================
-- Este archivo crea TODAS las tablas necesarias para que las páginas del
-- proyecto (donador/ y fundacion/) dejen de usar localStorage y trabajen
-- con datos reales guardados en Supabase.
--
-- CÓMO EJECUTARLO:
-- 1. Entra a tu proyecto en https://supabase.com
-- 2. Ve al menú lateral -> "SQL Editor" -> "New query"
-- 3. Pega TODO este archivo y dale "Run"
-- 4. Puedes ejecutarlo varias veces sin problema: usa "IF NOT EXISTS" y
--    "DROP POLICY IF EXISTS" para no romper nada si ya lo corriste antes.
--
-- ORDEN DE LAS TABLAS:
-- Supabase ya trae una tabla "auth.users" (usuarios/login). Nosotros NUNCA
-- la tocamos directamente: en vez de eso creamos una tabla "profiles" que
-- se conecta 1 a 1 con auth.users y nos dice si ese usuario es "donador"
-- o "fundacion". A partir de ahí, cada tipo de usuario tiene su propia
-- tabla de detalles (donor_profiles / foundations).
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONES NECESARIAS
-- ============================================================================
-- gen_random_uuid() nos permite generar IDs únicos automáticamente.
create extension if not exists "pgcrypto";


-- ============================================================================
-- 2. TABLA: profiles
-- ============================================================================
-- Guarda el "tipo" de cuenta (donador o fundación) para cada usuario que se
-- registra con Supabase Auth. Se llena automáticamente con un trigger cuando
-- alguien se registra (ver sección 10, más abajo).
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    role        text not null check (role in ('donador', 'fundacion')),
    full_name   text,               -- nombre de la persona o de la fundación
    created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Un registro por cada usuario logueado. Indica si es donador o fundación.';


-- ============================================================================
-- 3. TABLA: donor_profiles  (corresponde a donador/profile.html)
-- ============================================================================
create table if not exists public.donor_profiles (
    user_id             uuid primary key references public.profiles(id) on delete cascade,
    full_name           text,
    email               text,
    phone               text,
    occupation          text,
    bio                 text,
    avatar_url          text,               -- URL de la foto subida a Supabase Storage
    preferences         text[] default '{}', -- ej: {Food,Education,Health}
    preferred_contact    text,               -- 'email' | 'phone' | 'whatsapp'
    city                text,
    neighborhood        text,
    availability        text,               -- disponibilidad de voluntariado
    transport           text,
    language             text default 'en',
    theme               text default 'light',
    updated_at          timestamptz not null default now()
);

comment on table public.donor_profiles is 'Datos personales y preferencias de cada donador.';


-- ============================================================================
-- 4. TABLA: foundations  (corresponde a fundacion/profile.html)
-- ============================================================================
create table if not exists public.foundations (
    user_id         uuid primary key references public.profiles(id) on delete cascade,
    foundation_name text not null,
    tagline         text,
    mission         text,
    founded_year    int,
    category        text,
    schedule        text,            -- ej: "Mon-Fri 8am-5pm"
    address         text,
    phone           text,
    email           text,
    website         text,
    legal_id        text,            -- número de personería jurídica
    facebook        text,
    instagram       text,
    logo_url        text,
    verified        boolean not null default false,
    premium         boolean not null default false,  -- ver tabla premium_subscriptions
    latitude        double precision, -- para el mapa de foundations.html
    longitude       double precision,
    updated_at      timestamptz not null default now()
);

comment on table public.foundations is 'Perfil público de cada fundación (lo que ven los donadores).';


-- ============================================================================
-- 5. TABLA: foundation_team_members  (equipo, dentro de fundacion/profile.html)
-- ============================================================================
create table if not exists public.foundation_team_members (
    id              uuid primary key default gen_random_uuid(),
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    name            text not null,
    role            text,
    email           text,
    created_at      timestamptz not null default now()
);


-- ============================================================================
-- 6. TABLA: foundation_volunteers  (voluntarios internos de la fundación)
-- ============================================================================
create table if not exists public.foundation_volunteers (
    id              uuid primary key default gen_random_uuid(),
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    name            text not null,
    contact         text,
    role            text,
    status          text,        -- ej: 'Active' | 'Inactive' (solo se usa en el plan Verified Partner)
    created_at      timestamptz not null default now()
);


-- ============================================================================
-- 6b. TABLA: foundation_locations  (una o varias sedes/puntos de recepción)
-- ============================================================================
create table if not exists public.foundation_locations (
    id              uuid primary key default gen_random_uuid(),
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    name            text not null,
    address         text not null,
    created_at      timestamptz not null default now()
);


-- ============================================================================
-- 7. TABLA: campaigns  (corresponde a fundacion/add-campaign.html y campaigns.html)
-- ============================================================================
create table if not exists public.campaigns (
    id              uuid primary key default gen_random_uuid(),
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    name            text not null,
    category        text,
    end_date        date,
    goal_type       text not null default 'products' check (goal_type in ('products','money')),
    goal            numeric not null default 0,   -- meta (cantidad de productos o dinero)
    raised          numeric not null default 0,   -- avance actual (se actualiza con las donaciones)
    status          text not null default 'Active' check (status in ('Active','Paused','Ended')),
    featured        boolean not null default false,
    description     text,
    created_at      timestamptz not null default now()
);

comment on table public.campaigns is 'Campañas publicadas por cada fundación.';

-- Productos que necesita cada campaña (tabla hija de campaigns)
create table if not exists public.campaign_products (
    id              uuid primary key default gen_random_uuid(),
    campaign_id     uuid not null references public.campaigns(id) on delete cascade,
    product_name    text not null,
    quantity        int not null default 1
);


-- ============================================================================
-- 8. TABLA: foundation_resources  (corresponde a fundacion/add-resource.html y products.html)
-- ============================================================================
-- Estos son los "recursos/productos" que la fundación necesita en general,
-- sin estar atados a una campaña específica.
create table if not exists public.foundation_resources (
    id              uuid primary key default gen_random_uuid(),
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    name            text not null,
    category        text,
    priority        text,                -- ej: 'Low' | 'Medium' | 'High' | 'Urgent'
    quantity        int not null default 1,
    unit            text,                -- ej: 'units', 'kg', 'boxes'
    notes           text,
    received        int not null default 0, -- cuánto de esa meta ya se recibió (products.html)
    created_at      timestamptz not null default now()
);


-- ============================================================================
-- 9. TABLA: donations  (corresponde a donador/impact.html, dashboard, etc.)
-- ============================================================================
create table if not exists public.donations (
    id              uuid primary key default gen_random_uuid(),
    donor_id        uuid not null references public.donor_profiles(user_id) on delete cascade,
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    campaign_id     uuid references public.campaigns(id) on delete set null,
    product_name    text,
    quantity        int not null default 1,
    status          text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
    created_at      timestamptz not null default now()
);

comment on table public.donations is 'Registro de cada donación de un donador hacia una fundación/campaña.';


-- ============================================================================
-- 10. TABLA: support_requests  (corresponde al botón "Offer support" en campaigns.html)
-- ============================================================================
create table if not exists public.support_requests (
    id              uuid primary key default gen_random_uuid(),
    donor_id        uuid not null references public.donor_profiles(user_id) on delete cascade,
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    campaign_id     uuid references public.campaigns(id) on delete set null,
    support_type    text,        -- 'items' | 'volunteer' | 'contact'
    message         text,
    status          text not null default 'pending' check (status in ('pending','accepted','declined')),
    created_at      timestamptz not null default now()
);


-- ============================================================================
-- 11. TABLA: saved_campaigns  (campañas guardadas por un donador)
-- ============================================================================
create table if not exists public.saved_campaigns (
    donor_id        uuid not null references public.donor_profiles(user_id) on delete cascade,
    campaign_id     uuid not null references public.campaigns(id) on delete cascade,
    created_at      timestamptz not null default now(),
    primary key (donor_id, campaign_id)
);


-- ============================================================================
-- 12. TABLA: premium_subscriptions  (corresponde a fundacion/premium-checkout.html)
-- ============================================================================
create table if not exists public.premium_subscriptions (
    id              uuid primary key default gen_random_uuid(),
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    plan            text not null default 'premium',
    status          text not null default 'active' check (status in ('active','cancelled','past_due')),
    billing_email   text,
    card_last4      text,           -- solo los últimos 4 dígitos (dato no sensible); NUNCA el número completo
    started_at      timestamptz not null default now()
);

-- IMPORTANTE: nunca guardes número de tarjeta, CVC ni fecha de expiración en
-- esta ni en ninguna tabla. Esos datos deben ir directo a un proveedor de
-- pagos (ej. Stripe) y jamás pasar por tu base de datos.


-- ============================================================================
-- 13. TRIGGER: crear el "profile" (y el perfil detallado) automáticamente
--     cuando alguien se registra
-- ============================================================================
-- Cuando un usuario se registra con supabase.auth.signUp(...), nosotros le
-- pasamos "options.data" con el rol y varios datos del formulario (ver
-- /js/auth.js). Este trigger toma esos datos y crea automáticamente:
--   1. La fila en "profiles" (rol + nombre)
--   2. La fila en "donor_profiles" (si es donador) o "foundations" (si es
--      fundación) con lo que ya se llenó en el formulario de registro.
--
-- IMPORTANTE: este trigger corre con permisos de administrador
-- (security definer), así que funciona SIEMPRE, incluso si Supabase exige
-- confirmar el correo antes de crear una sesión. Antes, ese segundo paso
-- se hacía desde el navegador y podía fallar silenciosamente si todavía no
-- había sesión activa — por eso ahora se hace aquí, a nivel de base de datos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'donador');

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'full_name'
  );

  if v_role = 'donador' then
    insert into public.donor_profiles (user_id, full_name, email)
    values (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.email
    )
    on conflict (user_id) do nothing;
  elsif v_role = 'fundacion' then
    insert into public.foundations (user_id, foundation_name, email, phone, address)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'foundation_name', 'New Foundation'),
      new.email,
      new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'address'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- 14. SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- RLS es el "guardia de seguridad" de Supabase: sin esto, cualquier persona
-- con la anon key podría leer o modificar TODAS las filas de TODAS las
-- tablas. Con RLS activado, cada tabla solo permite lo que digan las
-- políticas de abajo.

alter table public.profiles                enable row level security;
alter table public.donor_profiles          enable row level security;
alter table public.foundations             enable row level security;
alter table public.foundation_team_members enable row level security;
alter table public.foundation_volunteers   enable row level security;
alter table public.foundation_locations    enable row level security;
alter table public.campaigns               enable row level security;
alter table public.campaign_products       enable row level security;
alter table public.foundation_resources    enable row level security;
alter table public.donations               enable row level security;
alter table public.support_requests        enable row level security;
alter table public.saved_campaigns         enable row level security;
alter table public.premium_subscriptions   enable row level security;

-- ---- profiles: cada quien ve y edita solo su propia fila ----
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);

-- ---- donor_profiles: el donador solo ve/edita su propio perfil ----
drop policy if exists "donor_select_own" on public.donor_profiles;
create policy "donor_select_own" on public.donor_profiles
    for select using (auth.uid() = user_id);

-- Política adicional: el NOMBRE de los donadores es visible para cualquiera.
-- Esto es necesario para el ranking público "Top Donors This Month" en
-- donador/dashboard.html. El resto de los campos (teléfono, dirección,
-- bio) NO tiene protección columna por columna en Postgres — si prefieres
-- que ni siquiera el nombre sea público, borra esta política y el ranking
-- de top donadores dejará de mostrar nombres.
drop policy if exists "donor_select_public" on public.donor_profiles;
create policy "donor_select_public" on public.donor_profiles
    for select using (true);

drop policy if exists "donor_insert_own" on public.donor_profiles;
create policy "donor_insert_own" on public.donor_profiles
    for insert with check (auth.uid() = user_id);

drop policy if exists "donor_update_own" on public.donor_profiles;
create policy "donor_update_own" on public.donor_profiles
    for update using (auth.uid() = user_id);

-- ---- foundations: el perfil es PÚBLICO (todos lo pueden leer, ej. en
--      foundations.html), pero solo la propia fundación lo puede editar ----
drop policy if exists "foundation_select_public" on public.foundations;
create policy "foundation_select_public" on public.foundations
    for select using (true);

drop policy if exists "foundation_insert_own" on public.foundations;
create policy "foundation_insert_own" on public.foundations
    for insert with check (auth.uid() = user_id);

drop policy if exists "foundation_update_own" on public.foundations;
create policy "foundation_update_own" on public.foundations
    for update using (auth.uid() = user_id);

-- ---- foundation_team_members / foundation_volunteers: públicos para leer,
--      solo editables por la fundación dueña ----
drop policy if exists "team_select_public" on public.foundation_team_members;
create policy "team_select_public" on public.foundation_team_members
    for select using (true);
drop policy if exists "team_write_own" on public.foundation_team_members;
create policy "team_write_own" on public.foundation_team_members
    for all using (auth.uid() = foundation_id) with check (auth.uid() = foundation_id);

drop policy if exists "vol_select_public" on public.foundation_volunteers;
create policy "vol_select_public" on public.foundation_volunteers
    for select using (true);
drop policy if exists "vol_write_own" on public.foundation_volunteers;
create policy "vol_write_own" on public.foundation_volunteers
    for all using (auth.uid() = foundation_id) with check (auth.uid() = foundation_id);

-- ---- foundation_locations: públicas para leer, solo editable por el dueño ----
drop policy if exists "loc_select_public" on public.foundation_locations;
create policy "loc_select_public" on public.foundation_locations
    for select using (true);
drop policy if exists "loc_write_own" on public.foundation_locations;
create policy "loc_write_own" on public.foundation_locations
    for all using (auth.uid() = foundation_id) with check (auth.uid() = foundation_id);

-- ---- campaigns: públicas para leer (campaigns.html), solo la fundación
--      dueña las puede crear/editar/borrar ----
drop policy if exists "campaigns_select_public" on public.campaigns;
create policy "campaigns_select_public" on public.campaigns
    for select using (true);

drop policy if exists "campaigns_write_own" on public.campaigns;
create policy "campaigns_write_own" on public.campaigns
    for all using (auth.uid() = foundation_id) with check (auth.uid() = foundation_id);

-- ---- campaign_products: públicos para leer; solo editable por el dueño
--      de la campaña a la que pertenecen ----
drop policy if exists "campaign_products_select_public" on public.campaign_products;
create policy "campaign_products_select_public" on public.campaign_products
    for select using (true);

drop policy if exists "campaign_products_write_own" on public.campaign_products;
create policy "campaign_products_write_own" on public.campaign_products
    for all using (
        exists (select 1 from public.campaigns c
                where c.id = campaign_id and c.foundation_id = auth.uid())
    ) with check (
        exists (select 1 from public.campaigns c
                where c.id = campaign_id and c.foundation_id = auth.uid())
    );

-- ---- foundation_resources: públicos para leer; solo editable por el dueño ----
drop policy if exists "resources_select_public" on public.foundation_resources;
create policy "resources_select_public" on public.foundation_resources
    for select using (true);

drop policy if exists "resources_write_own" on public.foundation_resources;
create policy "resources_write_own" on public.foundation_resources
    for all using (auth.uid() = foundation_id) with check (auth.uid() = foundation_id);

-- ---- donations: el donador ve/crea las suyas; la fundación ve las que
--      recibió ----
drop policy if exists "donations_select_involved" on public.donations;
create policy "donations_select_involved" on public.donations
    for select using (auth.uid() = donor_id or auth.uid() = foundation_id);

-- Política adicional: donor_id y quantity son visibles públicamente para
-- poder calcular el ranking "Top Donors This Month" sin sesión de por
-- medio. Si prefieres que las donaciones sean 100% privadas, borra esta
-- política (el ranking de top donadores dejará de funcionar).
drop policy if exists "donations_select_public_leaderboard" on public.donations;
create policy "donations_select_public_leaderboard" on public.donations
    for select using (true);

drop policy if exists "donations_insert_own" on public.donations;
create policy "donations_insert_own" on public.donations
    for insert with check (auth.uid() = donor_id);

drop policy if exists "donations_update_involved" on public.donations;
create policy "donations_update_involved" on public.donations
    for update using (auth.uid() = donor_id or auth.uid() = foundation_id);

-- ---- support_requests: igual que donations ----
drop policy if exists "support_select_involved" on public.support_requests;
create policy "support_select_involved" on public.support_requests
    for select using (auth.uid() = donor_id or auth.uid() = foundation_id);

drop policy if exists "support_insert_own" on public.support_requests;
create policy "support_insert_own" on public.support_requests
    for insert with check (auth.uid() = donor_id);

drop policy if exists "support_update_involved" on public.support_requests;
create policy "support_update_involved" on public.support_requests
    for update using (auth.uid() = donor_id or auth.uid() = foundation_id);

-- ---- saved_campaigns: solo el propio donador ----
drop policy if exists "saved_all_own" on public.saved_campaigns;
create policy "saved_all_own" on public.saved_campaigns
    for all using (auth.uid() = donor_id) with check (auth.uid() = donor_id);

-- ---- premium_subscriptions: solo la propia fundación ----
drop policy if exists "premium_all_own" on public.premium_subscriptions;
create policy "premium_all_own" on public.premium_subscriptions
    for all using (auth.uid() = foundation_id) with check (auth.uid() = foundation_id);


-- ============================================================================
-- 14b. TABLA: messages  (chat de ida y vuelta entre donador y fundación)
-- ============================================================================
create table if not exists public.messages (
    id              uuid primary key default gen_random_uuid(),
    donor_id        uuid not null references public.donor_profiles(user_id) on delete cascade,
    foundation_id   uuid not null references public.foundations(user_id) on delete cascade,
    campaign_id     uuid references public.campaigns(id) on delete set null,
    sender_role     text not null check (sender_role in ('donador','fundacion')),
    body            text not null,
    created_at      timestamptz not null default now(),
    read_at         timestamptz
);

comment on table public.messages is 'Chat de ida y vuelta entre un donador y una fundación.';

alter table public.messages enable row level security;

drop policy if exists "messages_select_involved" on public.messages;
create policy "messages_select_involved" on public.messages
    for select using (auth.uid() = donor_id or auth.uid() = foundation_id);

drop policy if exists "messages_insert_involved" on public.messages;
create policy "messages_insert_involved" on public.messages
    for insert with check (
        (auth.uid() = donor_id and sender_role = 'donador')
        or (auth.uid() = foundation_id and sender_role = 'fundacion')
    );

drop policy if exists "messages_update_involved" on public.messages;
create policy "messages_update_involved" on public.messages
    for update using (auth.uid() = donor_id or auth.uid() = foundation_id);


-- ============================================================================
-- 15. ÍNDICES (para que las consultas sean rápidas)
-- ============================================================================
create index if not exists idx_campaigns_foundation      on public.campaigns(foundation_id);
create index if not exists idx_campaign_products_campaign on public.campaign_products(campaign_id);
create index if not exists idx_resources_foundation       on public.foundation_resources(foundation_id);
create index if not exists idx_donations_donor            on public.donations(donor_id);
create index if not exists idx_donations_foundation       on public.donations(foundation_id);
create index if not exists idx_support_donor              on public.support_requests(donor_id);
create index if not exists idx_support_foundation         on public.support_requests(foundation_id);
create index if not exists idx_messages_donor             on public.messages(donor_id);
create index if not exists idx_messages_foundation        on public.messages(foundation_id);
create index if not exists idx_messages_conversation       on public.messages(donor_id, foundation_id, created_at);

-- ============================================================================
-- FIN DEL ESQUEMA
-- ============================================================================
