-- =====================================================================
--  OT SOLO CON MÁQUINAS DE LA LISTA (ejecutar después de 35_montacargas.sql; se puede volver a ejecutar)
--  Se quita "OTRO" de la Orden de Trabajo: escrita a mano, la misma máquina quedaba con mayúsculas,
--  minúsculas o numerales distintos y salía repetida en el dashboard. Si falta una, la agrega el admin
--  con "+ Nueva máquina" (agregar_maquina la guarda en mayúsculas y sin repetir). Igual que la OS (sql/28).
--  Las OT ya guardadas con otro nombre se quedan como están mientras no les cambien la máquina.
-- =====================================================================
drop trigger if exists t_maquina_valida on public.ordenes_trabajo;
create trigger t_maquina_valida before insert or update of maquina on public.ordenes_trabajo
  for each row
  execute function public.os_item_maquina_valida();   -- la misma regla de sql/28: la máquina debe estar en la lista

notify pgrst, 'reload schema';
