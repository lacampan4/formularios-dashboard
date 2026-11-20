-- =====================================================================
--  LISTO PARA RECOGER POR ÍTEM (ejecutar después de 45_os_corregir_cantidad.sql; se puede volver a ejecutar)
--  El responsable marca (o desmarca) cada ítem que ya está listo para recoger en bodega; quien la pidió ve
--  cuáles están listos y cuáles no. Reemplaza la marca de toda la orden (sql/33), que se deja como estaba.
--  No cambia el estado ni las firmas de entrega y recibido.
-- =====================================================================
alter table public.os_items add column if not exists listo_recoger_en timestamptz;
alter table public.os_items add column if not exists listo_recoger_por uuid references public.usuarios(id);

-- Las órdenes que ya estaban marcadas listas: sus ítems pendientes quedan listos, con la misma hora
update public.os_items i set listo_recoger_en = o.listo_recoger_en, listo_recoger_por = o.listo_recoger_por
from public.ordenes_suministro o
where o.id = i.os_id and o.listo_recoger_en is not null and o.estado <> 'Cerrada' and not i.entregado and i.listo_recoger_en is null;

create or replace function public.marcar_item_listo(item bigint, listo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update os_items i
    set listo_recoger_en = case when listo then now() end, listo_recoger_por = case when listo then auth.uid() end
  from ordenes_suministro o
  where i.id = item and o.id = i.os_id and o.responsable = auth.uid() and o.estado <> 'Cerrada';
  if not found then raise exception 'Solo el responsable puede marcar el ítem listo para recoger, y solo si la orden no está cerrada'; end if;
end; $$;
revoke execute on function public.marcar_item_listo(bigint, boolean) from public, anon;
grant execute on function public.marcar_item_listo(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
