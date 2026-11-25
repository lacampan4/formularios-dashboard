-- =====================================================================
--  "SST" EN LA MÁQUINA DE LA OS (ejecutar después de 50_os_quitar_firma.sql; se puede volver a ejecutar)
--  Los ítems de la Orden de Suministro que son para Seguridad y Salud en el Trabajo (EPP, señalización...)
--  se piden con la máquina "SST". Entra a la tabla maquinas para que la regla de sql/28 la acepte;
--  en el registro solo sale en la OS, al final (en la OT no).
-- =====================================================================
insert into public.maquinas (nombre, linea) values ('SST', null) on conflict (nombre) do nothing;

notify pgrst, 'reload schema';
