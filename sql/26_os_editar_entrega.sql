-- =====================================================================
--  EDITAR UNA ENTREGA Y BORRAR OS DESDE SUPABASE (ejecutar después de 25_os_entregas_parciales.sql;
--  se puede volver a ejecutar)
--  1. El responsable corrige la cantidad de una entrega mal digitada, mientras quien pidió no la haya
--     recibido. Queda la cantidad anterior y la hora del cambio.
--  2. Al borrar una OS (o un ítem) desde el Table Editor de Supabase se borran también sus entregas y
--     correcciones, como ya pasaba con sus ítems. La app sigue sin permitir borrar órdenes.
-- =====================================================================

-- 2. Borrado en cascada
alter table public.os_entregas drop constraint if exists os_entregas_item_id_fkey;
alter table public.os_entregas add constraint os_entregas_item_id_fkey
  foreign key (item_id) references public.os_items(id) on delete cascade;
alter table public.os_correcciones drop constraint if exists os_correcciones_item_id_fkey;
alter table public.os_correcciones add constraint os_correcciones_item_id_fkey
  foreign key (item_id) references public.os_items(id) on delete cascade;

-- 1. Editar la cantidad de una entrega
alter table public.os_entregas add column if not exists cantidad_anterior numeric;
alter table public.os_entregas add column if not exists editada_en timestamptz;

create or replace function public.editar_entrega(entrega bigint, cantidad numeric)
returns void language plpgsql security definer set search_path = public as $$
declare e os_entregas; i os_items; o ordenes_suministro; total numeric;
begin
  select * into e from os_entregas where id = entrega for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  select * into i from os_items where id = e.item_id for update;
  select * into o from ordenes_suministro where id = i.os_id for update;
  if o.responsable is distinct from auth.uid() then raise exception 'Solo el responsable de la % corrige sus entregas', o.numero; end if;
  if o.estado = 'Cerrada' then raise exception 'La % ya está cerrada', o.numero; end if;
  if e.recibido_por is not null then raise exception 'Esta entrega ya fue recibida: no se puede cambiar'; end if;
  total := coalesce(i.cantidad_entregada, 0) - e.cantidad + editar_entrega.cantidad;
  if editar_entrega.cantidad is null or editar_entrega.cantidad <= 0 or total > i.cantidad then
    raise exception 'Escriba más de 0 y hasta % %', trim_scale(i.cantidad - coalesce(i.cantidad_entregada, 0) + e.cantidad), i.medida;
  end if;
  if editar_entrega.cantidad = e.cantidad then return; end if;
  update os_entregas set cantidad_anterior = coalesce(cantidad_anterior, e.cantidad), cantidad = editar_entrega.cantidad, editada_en = now()
  where id = entrega;
  -- El ítem queda completo o vuelve a parcial según el nuevo total
  update os_items set cantidad_entregada = total,
    entregado_por = case when total = i.cantidad then coalesce(i.entregado_por, auth.uid()) end,
    entregado_en  = case when total = i.cantidad then coalesce(i.entregado_en, now()) end
  where id = i.id;
  if total < i.cantidad then update ordenes_suministro set estado = 'En proceso' where id = o.id; end if;
end; $$;
revoke execute on function public.editar_entrega(bigint, numeric) from public, anon;
grant execute on function public.editar_entrega(bigint, numeric) to authenticated;

notify pgrst, 'reload schema';
