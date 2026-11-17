-- =====================================================================
--  FORMULARIOS ADICIONALES POR USUARIO (ejecutar después de 29_ats_vencimiento.sql; se puede volver a ejecutar)
--  El admin le da a una persona formatos de más (OT, OS, ATS, Permiso) sin cambiarle el rol: en Usuarios,
--  columna "Formularios adicionales". Se suman a los de su rol en todas las reglas (puede()).
-- =====================================================================
alter table public.usuarios add column if not exists formatos_extra text[] not null default '{}';
alter table public.usuarios drop constraint if exists usuarios_formatos_extra_check;
alter table public.usuarios add constraint usuarios_formatos_extra_check check (formatos_extra <@ array['OT','OS','ATS','PERMISO']);

-- Igual que en 3_roles.sql, más los formatos adicionales del usuario
create or replace function public.puede(f text) returns boolean
language sql stable security definer set search_path = public as $$
  select mi_rol() = 'admin' or exists (select 1 from rol_formatos where rol = mi_rol() and formato = f)
    or exists (select 1 from usuarios where id = auth.uid() and f = any(formatos_extra));
$$;

-- Formatos que llena el usuario de la sesión (rol + adicionales; admin: todos), para las pestañas del registro
create or replace function public.mis_formatos() returns text[]
language sql stable security definer set search_path = public as $$
  select array(select x from unnest(array['OT','OS','ATS','PERMISO']) x where public.puede(x));
$$;
revoke execute on function public.mis_formatos() from public, anon;
grant execute on function public.mis_formatos() to authenticated;

-- Solo el admin cambia los formatos adicionales de alguien
create or replace function public.actualizar_formatos_extra(uid uuid, formatos text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede editar usuarios'; end if;
  update usuarios set formatos_extra = coalesce(array(select distinct upper(x) from unnest(formatos) x order by 1), '{}') where id = uid;
  if not found then raise exception 'Usuario no encontrado'; end if;
end; $$;
revoke execute on function public.actualizar_formatos_extra(uuid, text[]) from public, anon;
grant execute on function public.actualizar_formatos_extra(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';
