-- =====================================================================
--  ENTREGA PARCIAL POR ÍTEM EN LA OS (ejecutar después de 22_os_responsable.sql; se puede volver a ejecutar)
--  Al firmar la entrega de un ítem, el responsable dice cuánto entrega (por defecto, todo lo pedido).
--  Si no hay más en el almacén entrega menos: ej. 10 de 20 L. Quien pidió firma el recibido de eso
--  y, con el último recibido, la OS se cierra sola como siempre (sql/17).
--  Reemplaza el "Cerrar con entrega incompleta" con motivo de sql/22: se quitan la función y la columna.
-- =====================================================================

drop function if exists public.cerrar_os_incompleta(bigint, text);
alter table public.ordenes_suministro drop column if exists cierre_incompleto;

alter table public.os_items add column if not exists cantidad_entregada numeric;
alter table public.os_items drop constraint if exists os_items_cantidad_entregada_check;
alter table public.os_items add constraint os_items_cantidad_entregada_check
  check (cantidad_entregada is null or (cantidad_entregada > 0 and cantidad_entregada <= cantidad));
-- Entregas firmadas antes de este script: se entregó todo lo pedido
update public.os_items set cantidad_entregada = cantidad where entregado_por is not null and cantidad_entregada is null;

-- Igual que en 17_cierre_roles_maquinas.sql, más la cantidad entregada.
-- Se borra la versión de dos datos: con las dos, la API no sabría cuál usar.
drop function if exists public.firmar_item(bigint, text);
create or replace function public.firmar_item(item bigint, como text, cantidad numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare i os_items; o ordenes_suministro; c numeric;
begin
  select * into i from os_items where id = item for update;  -- dos firmas al tiempo no se pisan
  if not found then raise exception 'Ítem no encontrado'; end if;
  select * into o from ordenes_suministro where id = i.os_id for update;
  if o.estado <> 'Abierta' then raise exception 'La % ya está cerrada', o.numero; end if;
  if como = 'entrega' then
    if o.responsable is distinct from auth.uid() then raise exception 'Solo el responsable de la % firma la entrega', o.numero; end if;
    if i.entregado_por is not null then raise exception 'La entrega de este ítem ya está firmada'; end if;
    c := coalesce(firmar_item.cantidad, i.cantidad);
    if c <= 0 or c > i.cantidad then raise exception 'Entregue más de 0 y hasta % %', i.cantidad, i.medida; end if;
    update os_items set entregado_por = auth.uid(), entregado_en = now(), cantidad_entregada = c where id = item;
  elsif como = 'recibe' then
    if o.creado_por is distinct from auth.uid() then raise exception 'Solo quien pidió la % firma el recibido', o.numero; end if;
    if i.entregado_por is null then raise exception 'Primero el responsable debe firmar la entrega de este ítem'; end if;
    if i.recibido_por is not null then raise exception 'El recibido de este ítem ya está firmado'; end if;
    update os_items set recibido_por = auth.uid(), recibido_en = now() where id = item;
    if not exists (select 1 from os_items where os_id = o.id and not entregado) then
      update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = o.id;
    end if;
  else
    raise exception 'Firma no válida: use entrega o recibe';
  end if;
end; $$;
revoke execute on function public.firmar_item(bigint, text, numeric) from public, anon;
grant execute on function public.firmar_item(bigint, text, numeric) to authenticated;

notify pgrst, 'reload schema';
