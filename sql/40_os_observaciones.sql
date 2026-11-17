-- =====================================================================
--  OBSERVACIONES DEL RESPONSABLE EN LA OS (ejecutar después de 39_os_referencia_obligatoria.sql; se puede volver a ejecutar)
--  Solo el responsable escribe (o cambia) las observaciones de la orden, por ejemplo "el material está en
--  bodega pero no han pasado por él". Todos los que ven la orden las leen. Queda quién y cuándo las escribió.
--  No se pueden cambiar con la orden cerrada.
-- =====================================================================
alter table public.ordenes_suministro add column if not exists observaciones text;
alter table public.ordenes_suministro add column if not exists observaciones_en timestamptz;
alter table public.ordenes_suministro drop constraint if exists ordenes_suministro_observaciones_check;
alter table public.ordenes_suministro add constraint ordenes_suministro_observaciones_check
  check (char_length(observaciones) <= 500) not valid;

create or replace function public.guardar_observaciones_os(os bigint, texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_suministro
    set observaciones = nullif(btrim(texto), ''), observaciones_en = case when nullif(btrim(texto), '') is not null then now() end
  where id = os and responsable = auth.uid() and estado <> 'Cerrada';
  if not found then raise exception 'Solo el responsable puede escribir observaciones, y solo si la orden no está cerrada'; end if;
end; $$;
revoke execute on function public.guardar_observaciones_os(bigint, text) from public, anon;
grant execute on function public.guardar_observaciones_os(bigint, text) to authenticated;

notify pgrst, 'reload schema';
