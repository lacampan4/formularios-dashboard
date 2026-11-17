-- =====================================================================
--  "OTRO" EN LA MÁQUINA DE LA OT (ejecutar después de 37_restaurar_funciones_os.sql; se puede volver a ejecutar)
--  La OT vuelve a tener "OTRO" en la lista de máquinas, pero sin campo para escribir cuál: queda guardada
--  como "OTRO" y en el dashboard todas salen juntas. Para que la regla de sql/36 la acepte, "OTRO" entra a
--  la tabla maquinas (agregar_maquina y editar_maquina siguen sin dejar crear otra con ese nombre).
--  En el registro solo sale en la OT, al final; en la OS no.
-- =====================================================================
insert into public.maquinas (nombre, linea) values ('OTRO', null) on conflict (nombre) do nothing;
