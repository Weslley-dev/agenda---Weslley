-- Cole este SQL no Supabase: menu "SQL Editor" > New query > Run

-- Tabela de compromissos
create table public.eventos (
  id        uuid primary key,                                   -- o site gera o id
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo    text not null,
  data      date not null,
  hora      text not null,                                      -- formato "09:30"
  aviso     integer not null default 10,                        -- minutos antes (0 = sem aviso)
  cor       text not null default 'azul',
  nota      text not null default '',
  criado_em timestamptz not null default now()
);

create index eventos_user_data on public.eventos (user_id, data);

-- Segurança: cada usuário só enxerga e altera os próprios compromissos
alter table public.eventos enable row level security;

create policy "dono acessa os proprios eventos"
  on public.eventos
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
