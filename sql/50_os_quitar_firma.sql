-- =====================================================================
--  QUITAR UNA FIRMA MAL PUESTA EN LA OS (ejecutar después de 49_ats_sin_secciones.sql; se puede volver a ejecutar)
--  Solo el administrador, con el botón "Quitar" en Entregas por ítem:
--    'recibido' = quita la firma de recibido de esa entrega;
--    'entrega'  = quita la entrega (y su recibido, si lo tenía).
--  El ítem se recalcula con las entregas que quedan y, si la orden estaba cerrada, vuelve a Abierta.
--  Queda en el historial de correcciones del ítem: quién, cuándo y qué firma se quitó.
-- =====================================================================
alter table public.os_correcciones drop constraint if exists os_correcciones_tipo_check;
alter table public.os_correcciones add constraint os_correcciones_tipo_check
  check (tipo in ('Mal diligenciado', 'Mal entregado', 'Ajuste del responsable', 'Firma quitada'));

create or replace function public.quitar_firma(entrega bigint, que text)
returns void language plpgsql security definer set search_path = public as $$
declare e os_entregas; i os_items; o ordenes_suministro;
begin
  if not es_admin() then raise exception 'Solo el administrador quita firmas'; end if;
  select * into e from os_entregas where id = entrega for update;
  if not found then raise exception 'Entrega no encontrada'; end if;
  select * into i from os_items where id = e.item_id for update;
  select * into o from ordenes_suministro where id = i.os_id for update;
  if que = 'recibido' then
    if e.recibido_por is null then raise exception 'Esa entrega no tiene firma de recibido'; end if;
    update os_entregas set recibido_por = null, recibido_en = null where id = entrega;
  elsif que = 'entrega' then
    delete from os_entregas where id = entrega;
  else
    raise exception 'Firma no válida: use entrega o recibido';
  end if;
  -- El ítem se recalcula con las entregas que le quedan
  update os_items it set
    cantidad_entregada = s.total,
    entregado_por = case when coalesce(s.total, 0) >= it.cantidad then coalesce(it.entregado_por, s.ultimo_por) end,
    entregado_en  = case when coalesce(s.total, 0) >= it.cantidad then coalesce(it.entregado_en, s.ultimo_en) end,
    recibido_por  = case when coalesce(s.total, 0) >= it.cantidad and s.sin_recibir = 0 then it.recibido_por end,
    recibido_en   = case when coalesce(s.total, 0) >= it.cantidad and s.sin_recibir = 0 then it.recibido_en end
  from (select sum(cantidad) total, count(*) filter (where recibido_por is null) sin_recibir,
               (array_agg(entregado_por order by id desc))[1] ultimo_por, (array_agg(entregado_en order by id desc))[1] ultimo_en
        from os_entregas where item_id = i.id) s
  where it.id = i.id;
  update ordenes_suministro set estado = 'Abierta', cerrada_en = null
  where id = o.id and estado = 'Cerrada' and exists (select 1 from os_items where os_id = o.id and not entregado);
  insert into os_correcciones (item_id, tipo, detalle) values (i.id, 'Firma quitada',
    format('Se quitó la firma de %s de %s %s (firmada por %s el %s)',
      case when que = 'recibido' then 'recibido' else 'entrega' end, trim_scale(e.cantidad), i.medida,
      coalesce((select nombre from usuarios where id = case when que = 'recibido' then e.recibido_por else e.entregado_por end), '—'),
      to_char((case when que = 'recibido' then e.recibido_en else e.entregado_en end) at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI')));
end; $$;
revoke execute on function public.quitar_firma(bigint, text) from public, anon;
grant execute on function public.quitar_firma(bigint, text) to authenticated;

notify pgrst, 'reload schema';
