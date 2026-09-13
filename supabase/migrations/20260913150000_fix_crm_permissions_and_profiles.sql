-- Correção completa dos cadastros, perfis e imagens do Fenix Systens CRM.
alter table public.profiles add column if not exists phone text;
alter table public.products add column if not exists image_url text;

create or replace function public.handle_new_crm_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'phone',
    'user',
    'pending'
  )
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_crm on auth.users;
create trigger on_auth_user_created_crm
after insert on auth.users
for each row execute function public.handle_new_crm_user();

insert into public.profiles (id, full_name, email, phone, role, status)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
       coalesce(email, ''), raw_user_meta_data ->> 'phone', 'user', 'pending'
from auth.users
on conflict (id) do update set
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  phone = coalesce(public.profiles.phone, excluded.phone);

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.permissions := old.permissions;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields on public.profiles;
create trigger protect_profile_access_fields
before update on public.profiles
for each row execute function public.protect_profile_access_fields();

drop policy if exists "own profile or admin" on public.profiles;
drop policy if exists "profile insert own" on public.profiles;
drop policy if exists "profile update own or admin" on public.profiles;
drop policy if exists "profile delete admin" on public.profiles;
create policy "own profile or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profile insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profile update own or admin" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "profile delete admin" on public.profiles for delete to authenticated using (public.is_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array['customers','suppliers','products','inventory_movements','sales','sale_items','cash_transactions','financial_entries']
  loop
    execute format('drop policy if exists "authorized users manage CRM" on public.%I', table_name);
    execute format('create policy "authorized users manage CRM" on public.%I for all to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and status=''authorized'')) with check (exists(select 1 from public.profiles where id=auth.uid() and status=''authorized''))', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "authorized product image insert" on storage.objects;
drop policy if exists "authorized product image update" on storage.objects;
drop policy if exists "authorized product image delete" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id='product-images');
create policy "authorized product image insert" on storage.objects for insert to authenticated with check (bucket_id='product-images' and exists(select 1 from public.profiles where id=auth.uid() and status='authorized'));
create policy "authorized product image update" on storage.objects for update to authenticated using (bucket_id='product-images' and exists(select 1 from public.profiles where id=auth.uid() and status='authorized'));
create policy "authorized product image delete" on storage.objects for delete to authenticated using (bucket_id='product-images' and exists(select 1 from public.profiles where id=auth.uid() and status='authorized'));
