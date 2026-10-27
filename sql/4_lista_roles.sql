-- =====================================================================
--  LISTA DE ROLES (ejecutar después de 3_roles.sql; se puede volver a ejecutar)
--  Convierte usuarios.rol en un tipo lista: Table Editor muestra un desplegable
--  con todos los roles, incluido admin, en vez de un campo de texto libre.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario' and typnamespace = 'public'::regnamespace) then
    create type public.rol_usuario as enum ('admin','produccion','mantenimiento','abastecimiento','sst','sin_rol');
  end if;
end $$;

alter table public.usuarios drop constraint if exists usuarios_rol_check;  -- la lista reemplaza el check
alter table public.usuarios alter column rol drop default;
alter table public.usuarios alter column rol type public.rol_usuario using rol::text::public.rol_usuario;
alter table public.usuarios alter column rol set default 'sin_rol';

-- mi_rol() devuelve texto; con la lista hay que convertirlo
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select rol::text from usuarios where id = auth.uid()), 'sin_rol');
$$;
