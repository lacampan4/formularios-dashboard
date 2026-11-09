-- =====================================================================
--  VIGENCIA DE 24 HORAS EN EL ATS (ejecutar después de 20_sst_consulta.sql; se puede volver a ejecutar)
--  Pedido de SST: solo el ATS tiene vigencia máxima de 24 horas.
--   - ATS: fecha y hora de apertura + "válido hasta" (fecha y hora), máximo 24 h después de la apertura.
--   - Permiso: conserva "válido hasta" (sql/19), pero sin máximo; solo debe terminar después del inicio.
--  NOT VALID: se exige a los formatos nuevos; los guardados antes quedan como estaban.
-- =====================================================================

-- ATS
alter table public.ats add column if not exists hora_apertura time;
alter table public.ats add column if not exists vigente_hasta timestamp;
alter table public.ats drop constraint if exists ats_vigencia_24h;
alter table public.ats add constraint ats_vigencia_24h check (
  hora_apertura is not null and vigente_hasta is not null
  and vigente_hasta > fecha_apertura + hora_apertura
  and vigente_hasta <= fecha_apertura + hora_apertura + interval '24 hours') not valid;

-- Igual que en 1_esquema.sql, más la hora de apertura y la vigencia
create or replace function public.crear_ats(datos jsonb, trabajadores jsonb, pasos jsonb)
returns bigint language plpgsql set search_path = public as $$
declare a ats;
begin
  if coalesce(jsonb_array_length(trabajadores), 0) = 0 then raise exception 'El ATS necesita al menos un trabajador autorizado'; end if;
  if coalesce(jsonb_array_length(pasos), 0) = 0 then raise exception 'El ATS necesita al menos un paso de la actividad'; end if;
  insert into ats (ot_id, sede, area, jefe_inmediato, responsables, alturas, caliente, energias, descripcion_labor, equipos,
                   fecha_apertura, hora_apertura, vigente_hasta, fecha_cierre, firma_encargado, firma_jefe, firma_coord_alturas, firma_sst)
  select r.ot_id, r.sede, r.area, r.jefe_inmediato, r.responsables, coalesce(r.alturas, false), coalesce(r.caliente, false),
         coalesce(r.energias, false), r.descripcion_labor, r.equipos, coalesce(r.fecha_apertura, current_date), r.hora_apertura, r.vigente_hasta,
         r.fecha_cierre, r.firma_encargado, r.firma_jefe, r.firma_coord_alturas, r.firma_sst
  from jsonb_populate_record(null::ats, datos) r
  returning * into a;
  insert into ats_trabajadores (ats_id, nombre, cargo, salud_ok, medicamentos_sueno, afiliacion_ss, certificado)
  select a.id, t.nombre, t.cargo, t.salud_ok, t.medicamentos_sueno, t.afiliacion_ss, t.certificado
  from jsonb_populate_recordset(null::ats_trabajadores, trabajadores) t;
  insert into ats_pasos (ats_id, paso, peligros, consecuencias, controles)
  select a.id, p.paso, p.peligros, p.consecuencias, p.controles
  from jsonb_populate_recordset(null::ats_pasos, pasos) p;
  return a.id;
end; $$;

-- Permiso: sin máximo de 24 h (reemplaza la regla de 19); la vigencia sigue siendo obligatoria y posterior al inicio
alter table public.permisos_trabajo drop constraint if exists permisos_trabajo_vigencia_24h;
alter table public.permisos_trabajo drop constraint if exists permisos_trabajo_vigencia;
alter table public.permisos_trabajo add constraint permisos_trabajo_vigencia check (
  hora_inicio is not null and vigente_hasta is not null
  and vigente_hasta > fecha_ejecucion + hora_inicio) not valid;

notify pgrst, 'reload schema';
