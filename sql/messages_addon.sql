-- ============================================================================
-- HOPE HANDS · CHAT (mensajes entre donador y fundación)
-- ============================================================================
-- Este archivo es un AGREGADO al schema.sql principal — no reemplaza nada,
-- solo añade la tabla "messages" y sus reglas de seguridad. Pégalo como una
-- consulta NUEVA en el SQL Editor de Supabase (botón "+") y dale "Run".
-- Es seguro correrlo aunque ya hayas corrido schema.sql antes.
-- ============================================================================

-- ============================================================================
-- TABLA: messages
-- ============================================================================
-- Cada fila es UN mensaje dentro de una conversación entre un donador
-- específico y una fundación específica (opcionalmente ligada a una
-- campaña). "read_at" queda vacío hasta que el que recibe el mensaje lo
-- abre — eso es lo que permite mostrar el contador de "mensajes sin leer".
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

-- Seguridad: solo el donador o la fundación involucrados pueden ver o
-- escribir mensajes de su propia conversación.
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

-- Índices para que cargar una conversación o el conteo de no-leídos sea rápido.
create index if not exists idx_messages_donor       on public.messages(donor_id);
create index if not exists idx_messages_foundation  on public.messages(foundation_id);
create index if not exists idx_messages_conversation on public.messages(donor_id, foundation_id, created_at);

-- ============================================================================
-- FIN
-- ============================================================================
