-- ============================================================================
-- 14_image_generations.sql
-- Gerador de imagem (clone) — image-to-image via Kie (gpt-image-2).
-- Mesma filosofia das `generations` de áudio: linha por geração, status
-- assíncrono (pending -> generating -> ready/failed), arquivos no R2.
-- RLS por user_id (backend escreve via service_role). 1 crédito != 1 char aqui:
-- custo fixo por resolução (1K=12, 2K=22, 4K=30) gravado em credits_cost.
-- ============================================================================
create table if not exists public.image_generations (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    name              text,                 -- renomeável; null = usa fallback (data) na UI
    prompt            text not null,        -- prompt final enviado ao Kie
    idea              text,                 -- ideia crua do usuário (quando gerou prompt via LLM)
    input_image_path  text not null,        -- imagem de referência no R2 (a foto do usuário)
    aspect_ratio      text not null default 'auto',
    resolution        text not null default '1K',  -- 1K | 2K | 4K
    credits_cost      integer not null default 0,
    image_path        text,                 -- resultado no R2 (preenchido quando ready)
    status            text not null default 'pending',  -- pending|generating|ready|failed
    kie_task_id       text,
    error_message     text,
    created_at        timestamptz not null default now()
);

create index if not exists idx_image_generations_user
    on public.image_generations (user_id, created_at desc);
create index if not exists idx_image_generations_kie
    on public.image_generations (kie_task_id);

-- RLS: usuário só vê/cria/deleta as próprias; update via backend (service_role).
alter table public.image_generations enable row level security;

drop policy if exists image_generations_self_select on public.image_generations;
create policy image_generations_self_select on public.image_generations
  for select using (auth.uid() = user_id);

drop policy if exists image_generations_self_insert on public.image_generations;
create policy image_generations_self_insert on public.image_generations
  for insert with check (auth.uid() = user_id);

drop policy if exists image_generations_self_delete on public.image_generations;
create policy image_generations_self_delete on public.image_generations
  for delete using (auth.uid() = user_id);
