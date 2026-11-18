-- =====================================================================
--  AL FIRMAR, LA OS VUELVE A ABIERTA (ejecutar después de 43_os_cierre_en_proceso.sql; se puede volver a ejecutar)
--  "En proceso" lo pone el responsable con "Poner en proceso" mientras gestiona la orden. En cuanto alguien
--  firma (entrega, entrega parcial o recibido) la orden vuelve a "Abierta"; con el último recibido se cierra
--  sola, como siempre. La entrega parcial ya no la pone En proceso.
-- =====================================================================

-- Igual que en 43_os_cierre_en_proceso.sql, salvo el estado al firmar
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
  update ordenes_suministro set estado = 'Abierta' where id = o.id and estado = 'En proceso';   -- firmó alguien: vuelve a Abierta
end; $$;
revoke execute on function public.firmar_item(bigint, text, numeric) from public, anon;
grant execute on function public.firmar_item(bigint, text, numeric) to authenticated;

notify pgrst, 'reload schema';
