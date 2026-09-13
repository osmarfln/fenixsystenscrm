-- Garante perfil pendente e notificação administrativa para todo novo usuário.
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
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone);

  insert into public.audit_logs (user_id, action, module, description)
  values (new.id, 'pending_user', 'Gestão de Usuários',
    'Novo usuário pendente: ' || coalesce(new.raw_user_meta_data ->> 'full_name', new.email, new.id::text));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_crm on auth.users;
create trigger on_auth_user_created_crm
after insert on auth.users
for each row execute function public.handle_new_crm_user();

insert into public.profiles (id, full_name, email, phone, role, status)
select id,
       coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
       coalesce(email, ''),
       raw_user_meta_data ->> 'phone',
       'user',
       'pending'
from auth.users
on conflict (id) do nothing;
