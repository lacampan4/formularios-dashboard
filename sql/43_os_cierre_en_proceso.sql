-- =====================================================================
--  CIERRE DE LA OS EN PROCESO (ejecutar después de 42_montacargas_lista.sql; se puede volver a ejecutar)
--  1. cerrar_os también cierra órdenes "En proceso" (antes solo "Abierta" y el botón daba error).
--  2. firmar_item queda en su versión actual (sql/25): firma entregas y recibidos con la orden Abierta o
--     En proceso, y con el último recibido la cierra sola. Si se volvió a ejecutar un SQL viejo (17 o 23),
--     la orden en proceso no dejaba firmar ni se cerraba.
--  3. Cierra las órdenes que ya tienen todos los ítems entregados y recibidos pero quedaron sin cerrar.
-- =====================================================================
create or replace function public.cerrar_os(os bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from ordenes_suministro where id = os and responsable = auth.uid() and estado <> 'Cerrada') then
    raise exception 'Solo el responsable puede cerrar esta orden, y solo si no está cerrada';
  end if;
  if exists (select 1 from os_items where os_id = os and not entregado) then
    raise exception 'Faltan ítems por entregar y recibir: cada ítem necesita las dos firmas antes de cerrar la orden';
  end if;
  update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = os;
end; $$;
revoke execute on function public.cerrar_os(bigint) from public, anon;
grant execute on function public.cerrar_os(bigint) to authenticated;

-- Igual que en 25_os_entregas_parciales.sql
drop function if exists public.firmar_item(bigint, text, numeric);
create function public.firmar_item(item bigint, como text, cantidad numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare i os_items; o ordenes_suministro; falta numeric; c numeric;
begin
  select * into i from os_items where id = item for update;  -- dos firmas al tiempo no se pisan
  if not found then raise exception 'Ítem no encontrado'; end if;
  select * into o from ordenes_suministro where id = i.os_id for update;
  if o.estado = 'Cerrada' then raise exception 'La % ya está cerrada', o.numero; end if;
  if como = 'entrega' then
    if o.responsable is distinct from auth.uid() then raise exception 'Solo el responsable de la % firma la entrega', o.numero; end if;
    if i.entregado_por is not null then raise exception 'Este ítem ya se entregó completo'; end if;
    falta := i.cantidad - coalesce(i.cantidad_entregada, 0);
    c := coalesce(firmar_item.cantidad, falta);   -- sin cantidad: entrega todo lo que falta
    if c <= 0 or c > falta then raise exception 'Entregue más de 0 y hasta % % (lo que falta)', falta, i.medida; end if;
    insert into os_entregas (item_id, cantidad) values (item, c);
    update os_items set cantidad_entregada = coalesce(cantidad_entregada, 0) + c,
      entregado_por = case when c = falta then auth.uid() end, entregado_en = case when c = falta then now() end
    where id = item;
    if c < falta then update ordenes_suministro set estado = 'En proceso' where id = o.id; end if;
  elsif como = 'recibe' then
    if o.creado_por is distinct from auth.uid() then raise exception 'Solo quien pidió la % firma el recibido', o.numero; end if;
    update os_entregas set recibido_por = auth.uid(), recibido_en = now() where item_id = item and recibido_por is null;
    if not found then raise exception 'No hay entregas de este ítem por recibir'; end if;
    if i.entregado_por is not null then
      update os_items set recibido_por = auth.uid(), recibido_en = now() where id = item;
    end if;
    if not exists (select 1 from os_items where os_id = o.id and not entregado) then
      update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = o.id;
    end if;
  else
    raise exception 'Firma no válida: use entrega o recibe';
  end if;
end; $$;
revoke execute on function public.firmar_item(bigint, text, numeric) from public, anon;
grant execute on function public.firmar_item(bigint, text, numeric) to authenticated;

-- Órdenes con todo entregado y recibido que quedaron abiertas o en proceso
update public.ordenes_suministro o set estado = 'Cerrada', cerrada_en = coalesce(
    (select max(i.recibido_en) from public.os_items i where i.os_id = o.id), now())
where o.estado <> 'Cerrada'
  and exists (select 1 from public.os_items i where i.os_id = o.id)
  and not exists (select 1 from public.os_items i where i.os_id = o.id and not i.entregado);

notify pgrst, 'reload schema';
