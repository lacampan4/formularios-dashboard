-- =====================================================================
--  ATS SIN LAS SECCIONES 1 A 4 (ejecutar después de 48_ats_permiso_dias.sql; se puede volver a ejecutar)
--  El ATS queda con la OT, "Fechas y responsables" y el permiso completo (sql/48). Ya no lleva información
--  general, trabajadores autorizados, descripción de la labor ni paso a paso: la descripción deja de ser
--  obligatoria y crear_ats ya no exige trabajadores ni pasos. Los ATS de antes conservan lo que tenían.
-- =====================================================================
alter table public.ats alter column descripcion_labor drop not null;
alter table public.ats drop constraint if exists ats_descripcion_labor_check;

-- Igual que en 48_ats_permiso_dias.sql, sin exigir trabajadores ni pasos (si llegan, se guardan)
create or replace function public.crear_ats(datos jsonb, trabajadores jsonb, pasos jsonb)
returns bigint language plpgsql set search_path = public as $$
declare a ats;
begin
  insert into ats (ot_id, sede, area, jefe_inmediato, responsables, alturas, caliente, energias, descripcion_labor, equipos,
                   fecha_apertura, hora_apertura, vigente_hasta, fecha_cierre, firma_encargado, firma_jefe, firma_coord_alturas, firma_sst, permiso)
  select r.ot_id, r.sede, r.area, r.jefe_inmediato, r.responsables, coalesce(r.alturas, false), coalesce(r.caliente, false),
         coalesce(r.energias, false), nullif(btrim(r.descripcion_labor), ''), r.equipos, coalesce(r.fecha_apertura, current_date), r.hora_apertura, r.vigente_hasta,
         r.fecha_cierre, r.firma_encargado, r.firma_jefe, r.firma_coord_alturas, r.firma_sst, coalesce(r.permiso, '{}')
  from jsonb_populate_record(null::ats, datos) r
  returning * into a;
  insert into ats_trabajadores (ats_id, nombre, cargo, salud_ok, medicamentos_sueno, afiliacion_ss, certificado)
  select a.id, t.nombre, t.cargo, t.salud_ok, t.medicamentos_sueno, t.afiliacion_ss, t.certificado
  from jsonb_populate_recordset(null::ats_trabajadores, coalesce(trabajadores, '[]')) t;
  insert into ats_pasos (ats_id, paso, peligros, consecuencias, controles)
  select a.id, p.paso, p.peligros, p.consecuencias, p.controles
  from jsonb_populate_recordset(null::ats_pasos, coalesce(pasos, '[]')) p;
  return a.id;
end; $$;

notify pgrst, 'reload schema';
