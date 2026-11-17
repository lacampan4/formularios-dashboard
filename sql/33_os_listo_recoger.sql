-- =====================================================================
--  OS LISTA PARA RECOGER EN BODEGA (ejecutar después de 32_os_libras_stock.sql; se puede volver a ejecutar)
--  El responsable marca (o desmarca) que la orden ya está lista para recoger en bodega. Queda quién y cuándo,
--  y quien la pidió lo ve en su bandeja. No cambia el estado ni las firmas de entrega y recibido.
-- =====================================================================
alter table public.ordenes_suministro add column if not exists listo_recoger_en timestamptz;
alter table public.ordenes_suministro add column if not exists listo_recoger_por uuid references public.usuarios(id);

create or replace function public.marcar_listo_recoger(os bigint, listo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_suministro
    set listo_recoger_en = case when listo then now() end, listo_recoger_por = case when listo then auth.uid() end
  where id = os and responsable = auth.uid() and estado <> 'Cerrada';
  if not found then raise exception 'Solo el responsable puede marcar la orden lista para recoger, y solo si no está cerrada'; end if;
end; $$;
revoke execute on function public.marcar_listo_recoger(bigint, boolean) from public, anon;
grant execute on function public.marcar_listo_recoger(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
