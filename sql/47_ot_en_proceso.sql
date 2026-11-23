-- =====================================================================
--  PONER LA OT EN PROCESO (ejecutar después de 46_os_item_listo.sql; se puede volver a ejecutar)
--  Como en la OS (sql/27), el responsable de una OT abierta la marca "En proceso" cuando empieza a
--  trabajarla. Con la OT en proceso puede seguir marcando si requiere ATS y permiso, y la cierra igual.
-- =====================================================================
alter table public.ordenes_trabajo drop constraint if exists ordenes_trabajo_estado_check;
alter table public.ordenes_trabajo add constraint ordenes_trabajo_estado_check
  check (estado in ('Abierta', 'En proceso', 'Cerrada'));

create or replace function public.poner_ot_en_proceso(ot bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_trabajo set estado = 'En proceso' where id = ot and responsable = auth.uid() and estado = 'Abierta';
  if not found then raise exception 'Solo el responsable puede poner la orden en proceso, y solo si está abierta'; end if;
end; $$;
revoke execute on function public.poner_ot_en_proceso(bigint) from public, anon;
grant execute on function public.poner_ot_en_proceso(bigint) to authenticated;

-- Igual que en 5_bandeja.sql, pero también cierra la OT en proceso
create or replace function public.cerrar_ot(ot bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_trabajo set estado = 'Cerrada', cerrada_en = now()
  where id = ot and responsable = auth.uid() and estado <> 'Cerrada';
  if not found then raise exception 'Solo el responsable puede cerrar esta orden, y solo si no está cerrada'; end if;
end; $$;

-- Igual que en 8_ot_requisitos.sql, pero también con la OT en proceso
create or replace function public.marcar_requisitos_ot(ot bigint, ats boolean, permiso boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_trabajo set requiere_ats = ats, requiere_permiso = permiso
  where id = ot and responsable = auth.uid() and estado <> 'Cerrada';
  if not found then raise exception 'Solo el responsable puede marcar esto, y la orden no debe estar cerrada'; end if;
end; $$;

notify pgrst, 'reload schema';
