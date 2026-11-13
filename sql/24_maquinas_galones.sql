-- =====================================================================
--  EDITAR MÁQUINAS Y GALONES (ejecutar después de 23_os_entrega_parcial.sql; se puede volver a ejecutar)
--  1. El admin corrige el nombre o la línea de una máquina de la lista. Las órdenes ya guardadas
--     conservan el nombre con que se registraron.
--  2. Los ítems de la OS se pueden pedir en galones (gal), además de und, kg, m y L.
-- =====================================================================

-- 1. Mismas reglas que agregar_maquina (sql/17): en mayúsculas, sin repetir, sin "OTRO"
create or replace function public.editar_maquina(actual text, nombre text, linea text default null)
returns text language plpgsql security definer set search_path = public as $$
declare n text := upper(btrim(nombre));
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede editar máquinas'; end if;
  if coalesce(n, '') = '' or length(n) > 80 then raise exception 'El nombre de la máquina debe tener entre 1 y 80 caracteres'; end if;
  if n = 'OTRO' then raise exception 'OTRO ya es una opción de la lista'; end if;
  if linea is not null and linea not in ('CTL', 'Slitter', 'Cubiertas', 'Perlin en C', 'Entrepiso') then raise exception 'Línea no válida'; end if;
  if exists (select 1 from maquinas m where upper(m.nombre) = n and m.nombre <> actual) then raise exception 'Ya existe la máquina %', n; end if;
  update maquinas set nombre = n, linea = nullif(editar_maquina.linea, '') where maquinas.nombre = actual;
  if not found then raise exception 'La máquina % no está en la lista', actual; end if;
  return n;
end; $$;
revoke execute on function public.editar_maquina(text, text, text) from public, anon;
grant execute on function public.editar_maquina(text, text, text) to authenticated;

-- 2. Galones
alter table public.os_items drop constraint if exists os_items_medida_check;
alter table public.os_items add constraint os_items_medida_check check (medida in ('und', 'kg', 'm', 'L', 'gal'));

notify pgrst, 'reload schema';
