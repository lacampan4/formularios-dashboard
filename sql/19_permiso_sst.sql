-- =====================================================================
--  PERMISO COMPLETO Y SEGUIMIENTO DE SST (ejecutar después de 18_ats_estado.sql; se puede volver a ejecutar)
--  Pedido de Seguridad y Salud en el Trabajo:
--   1. El permiso sigue el FR-SST-039 completo (borrador de SST). Las secciones nuevas (generalidades,
--      medidas específicas, listas de trabajo en caliente, verificación diaria, cierre detallado) se guardan
--      en detalle_extra; aquí solo cambia lo que la base debe hacer cumplir.
--   2. La vigencia del permiso no puede pasar de 24 horas desde el inicio.
--   3. El usuario de SST crea los cuatro formatos y ve en Consulta todos los formatos de todos (OT, OS, ATS y
--      permisos), para hacer seguimiento.
-- =====================================================================

-- 2. Vigencia: hasta cuándo vale el permiso (fecha y hora local). Máximo 24 h después del inicio.
--    NOT VALID: se exige a los permisos nuevos; los guardados antes (vigencia en texto libre) quedan como estaban.
alter table public.permisos_trabajo add column if not exists vigente_hasta timestamp;
alter table public.permisos_trabajo drop constraint if exists permisos_trabajo_vigencia_24h;
alter table public.permisos_trabajo add constraint permisos_trabajo_vigencia_24h check (
  hora_inicio is not null and vigente_hasta is not null
  and vigente_hasta > fecha_ejecucion + hora_inicio
  and vigente_hasta <= fecha_ejecucion + hora_inicio + interval '24 hours') not valid;

-- Sección 5 del formato: se agrega "Trabajo con izaje de cargas"
alter table public.permisos_trabajo drop constraint if exists permisos_trabajo_tipos_check;
alter table public.permisos_trabajo add constraint permisos_trabajo_tipos_check
  check (tipos <@ array['alturas','caliente','energias','electrico','izaje'] and cardinality(tipos) > 0);

-- 3. SST llena los cuatro formatos (antes solo ATS y Permiso)
insert into public.rol_formatos (rol, formato) values ('sst', 'OT'), ('sst', 'OS'), ('sst', 'ATS'), ('sst', 'PERMISO')
on conflict do nothing;

-- SST (y el admin) ve todos los formatos con su detalle. Las OT ya las ven todos los roles.
create or replace function public.ve_seguridad() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.mi_rol() = 'sst';
$$;
revoke execute on function public.ve_seguridad() from public, anon;
grant execute on function public.ve_seguridad() to authenticated;

drop policy if exists "leer" on public.ats;
create policy "leer" on public.ats for select to authenticated
  using (public.puede('ATS') or public.puede('PERMISO') or public.ve_seguridad());
drop policy if exists "leer" on public.ats_trabajadores;
create policy "leer" on public.ats_trabajadores for select to authenticated using (public.ve_seguridad()
  or exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));
drop policy if exists "leer" on public.ats_pasos;
create policy "leer" on public.ats_pasos for select to authenticated using (public.ve_seguridad()
  or exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));
drop policy if exists "leer" on public.permisos_trabajo;
create policy "leer" on public.permisos_trabajo for select to authenticated
  using (creado_por = auth.uid() or public.ve_seguridad());

-- OT y OS de los demás: se suma una regla de lectura (las reglas de cada tabla se combinan con "o")
do $$
declare t text;
begin
  foreach t in array array['ot_lineas', 'ordenes_suministro', 'os_items', 'os_correcciones'] loop
    execute format('drop policy if exists "seguridad" on public.%I', t);
    execute format('create policy "seguridad" on public.%I for select to authenticated using (public.ve_seguridad())', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
