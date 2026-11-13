-- =====================================================================
--  PONER LA OS EN PROCESO (ejecutar después de 26_os_editar_entrega.sql; se puede volver a ejecutar)
--  El responsable marca una OS abierta como "En proceso" (ya la está gestionando), aunque no haya
--  entregado nada todavía. Se sigue cerrando sola con el último recibido.
-- =====================================================================
create or replace function public.poner_en_proceso(os bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_suministro set estado = 'En proceso' where id = os and responsable = auth.uid() and estado = 'Abierta';
  if not found then raise exception 'Solo el responsable puede poner la orden en proceso, y solo si está abierta'; end if;
end; $$;
revoke execute on function public.poner_en_proceso(bigint) from public, anon;
grant execute on function public.poner_en_proceso(bigint) to authenticated;

notify pgrst, 'reload schema';
