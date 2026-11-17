-- =====================================================================
--  VIGENCIA AUTOMÁTICA DEL ATS (ejecutar después de 28_os_maquina_lista.sql; se puede volver a ejecutar)
--  Pedido de SST: nadie escribe horas. Al guardar el ATS empieza a contar la vigencia (hora del servidor)
--  y a las 24 horas se cierra solo. Reemplaza la vigencia escrita a mano de 21_ats_vigencia.sql.
--  Si antes se cierra la OT, el ATS se sigue cerrando con ella (18_ats_estado.sql).
--
--  El cierre lo hace una tarea programada de Supabase (pg_cron) que corre cada minuto.
--  Si pg_cron no se puede activar desde aquí: Supabase > Database > Extensions > pg_cron > Enable,
--  y vuelva a ejecutar este script.
-- =====================================================================

-- La vigencia ahora es un instante exacto (con zona horaria) y ya no la exige el formulario
alter table public.ats drop constraint if exists ats_vigencia_24h;
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'ats' and column_name = 'vigente_hasta') = 'timestamp without time zone' then
    alter table public.ats alter column vigente_hasta type timestamptz using vigente_hasta at time zone 'America/Bogota';
  end if;
end $$;

-- Al crearlo: apertura = ahora (hora de Colombia), vence 24 h después; abierto, o ya cerrado si su OT está cerrada
create or replace function public.preparar_ats()
returns trigger language plpgsql security definer set search_path = public as $$
declare o ordenes_trabajo; ahora timestamptz := now();
begin
  new.fecha_apertura := (ahora at time zone 'America/Bogota')::date;
  new.hora_apertura := (ahora at time zone 'America/Bogota')::time(0);
  new.vigente_hasta := ahora + interval '24 hours';
  select * into o from ordenes_trabajo where id = new.ot_id;
  new.estado := case when o.estado = 'Cerrada' then 'Cerrada' else 'Abierta' end;
  new.cerrada_en := case when o.estado = 'Cerrada' then o.cerrada_en end;
  return new;
end; $$;
revoke execute on function public.preparar_ats() from public, anon, authenticated;

-- ATS guardados antes: su vigencia también cuenta desde que se guardaron
update public.ats set vigente_hasta = creado_en + interval '24 hours',
  fecha_apertura = (creado_en at time zone 'America/Bogota')::date,
  hora_apertura = (creado_en at time zone 'America/Bogota')::time(0)
where vigente_hasta is distinct from creado_en + interval '24 hours';

-- Cierra los ATS abiertos que ya cumplieron 24 h, con la hora exacta en que vencieron
create or replace function public.cerrar_ats_vencidos()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update ats set estado = 'Cerrada', cerrada_en = vigente_hasta where estado = 'Abierta' and vigente_hasta <= now();
  get diagnostics n = row_count;
  return n;
end; $$;
revoke execute on function public.cerrar_ats_vencidos() from public, anon, authenticated;

-- Tarea programada cada minuto (pg_cron). Sin pg_cron (por ejemplo en la prueba local) solo avisa.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    if exists (select 1 from cron.job where jobname = 'cerrar-ats-vencidos') then
      perform cron.unschedule('cerrar-ats-vencidos');
    end if;
    perform cron.schedule('cerrar-ats-vencidos', '* * * * *', 'select public.cerrar_ats_vencidos()');
  else
    raise notice 'pg_cron no está disponible: active la extensión en Supabase y vuelva a ejecutar este script';
  end if;
end $$;
select public.cerrar_ats_vencidos();  -- cierra de una vez los que ya vencieron

notify pgrst, 'reload schema';
