-- Produtos = catálogo comercial; Estoque = disponibilidade e localização.
alter table public.products add column if not exists description text;
alter table public.products add column if not exists location text;
