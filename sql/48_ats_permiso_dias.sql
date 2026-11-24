-- =====================================================================
--  ATS CON EL PERMISO COMPLETO Y LISTAS DE 7 DÍAS (ejecutar después de 47_ot_en_proceso.sql; se puede volver a ejecutar)
--  1. El ATS lleva también todo el FR-SST-039 (las dos hojas del Excel): se guarda en ats.permiso con la misma
--     forma de un permiso (columnas + detalle_extra).
--  2. Listas de chequeo de cada herramienta y verificación diaria: como en el Excel, hasta 7 días. El día 1 se
--     llena al registrar; los días 2 a 7 se agregan en Consulta (agregar_dia), uno por fecha, con la fecha del servidor.
--     Quedan en detalle_extra.dias = [{fecha, por, verificacion, caliente}].
-- =====================================================================
alter table public.ats add column if not exists permiso jsonb not null default '{}';

-- Igual que en 21_ats_vigencia.sql, más el permiso completo
create or replace function public.crear_ats(datos jsonb, trabajadores jsonb, pasos jsonb)
returns bigint language plpgsql set search_path = public as $$
declare a ats;
begin
  if coalesce(jsonb_array_length(trabajadores), 0) = 0 then raise exception 'El ATS necesita al menos un trabajador autorizado'; end if;
  if coalesce(jsonb_array_length(pasos), 0) = 0 then raise exception 'El ATS necesita al menos un paso de la actividad'; end if;
  insert into ats (ot_id, sede, area, jefe_inmediato, responsables, alturas, caliente, energias, descripcion_labor, equipos,
                   fecha_apertura, hora_apertura, vigente_hasta, fecha_cierre, firma_encargado, firma_jefe, firma_coord_alturas, firma_sst, permiso)
  select r.ot_id, r.sede, r.area, r.jefe_inmediato, r.responsables, coalesce(r.alturas, false), coalesce(r.caliente, false),
         coalesce(r.energias, false), r.descripcion_labor, r.equipos, coalesce(r.fecha_apertura, current_date), r.hora_apertura, r.vigente_hasta,
         r.fecha_cierre, r.firma_encargado, r.firma_jefe, r.firma_coord_alturas, r.firma_sst, coalesce(r.permiso, '{}')
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

-- Agrega el día de hoy a las listas de un permiso ('PT') o del permiso de un ATS ('ATS').
-- Lo hace quien lo registró, SST o el admin; máximo 7 días y uno por fecha. Devuelve el número del día.
create or replace function public.agregar_dia(formato text, registro bigint, dia jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare d jsonb; hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if jsonb_typeof(dia) is distinct from 'object' then raise exception 'Día inválido'; end if;
  if formato = 'PT' then
    select coalesce(detalle_extra -> 'dias', '[]') into d from permisos_trabajo
    where id = registro and (creado_por = auth.uid() or ve_seguridad()) and detalle_extra ? 'dias' for update;
  elsif formato = 'ATS' then
    select coalesce(permiso -> 'detalle_extra' -> 'dias', '[]') into d from ats
    where id = registro and (creado_por = auth.uid() or ve_seguridad()) and permiso -> 'detalle_extra' ? 'dias' for update;
  end if;
  if d is null then raise exception 'No puede agregar días a este formato'; end if;
  if jsonb_array_length(d) >= 7 then raise exception 'La lista ya tiene los 7 días'; end if;
  if exists (select 1 from jsonb_array_elements(d) e where e ->> 'fecha' = hoy::text) then
    raise exception 'El día de hoy ya está diligenciado';
  end if;
  d := d || jsonb_build_array(dia || jsonb_build_object('fecha', hoy, 'por', auth.uid()));
  if formato = 'PT' then
    update permisos_trabajo set detalle_extra = jsonb_set(detalle_extra, '{dias}', d) where id = registro;
  else
    update ats set permiso = jsonb_set(permiso, '{detalle_extra,dias}', d) where id = registro;
  end if;
  return jsonb_array_length(d);
end; $$;
revoke execute on function public.agregar_dia(text, bigint, jsonb) from public, anon;
grant execute on function public.agregar_dia(text, bigint, jsonb) to authenticated;

notify pgrst, 'reload schema';
