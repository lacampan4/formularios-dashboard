-- =====================================================================
--  SST EN CONSULTA: SOLO ATS Y PERMISOS (ejecutar después de 19_permiso_sst.sql; se puede volver a ejecutar)
--  SST sigue llenando los cuatro formatos y viendo todos los ATS y permisos de la planta (19), pero ya no
--  lee las OT y OS de los demás con su detalle: se quita la regla "seguridad" que 19 había sumado a esas tablas.
--  Sus propias OS las sigue viendo como cualquier usuario (quien la pidió y el responsable).
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['ot_lineas', 'ordenes_suministro', 'os_items', 'os_correcciones'] loop
    execute format('drop policy if exists "seguridad" on public.%I', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
