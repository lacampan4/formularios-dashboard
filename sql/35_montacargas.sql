-- =====================================================================
--  MONTACARGAS #1 A #13 (ejecutar después de 34_os_sin_descripcion.sql; se puede volver a ejecutar)
--  Cada montacargas queda como máquina propia ("MONTACARGA #1" … "MONTACARGA #13"), así se sabe en OT, OS,
--  consulta y Excel cuál fue. En las listas del registro salen como un solo "MONTACARGA" y al lado se escoge
--  el número (registro.js). Cualquier máquina que se llame "NOMBRE #N" se agrupa igual.
-- =====================================================================
insert into public.maquinas (nombre, linea)
select 'MONTACARGA #' || n, null from generate_series(1, 13) n
on conflict (nombre) do nothing;
