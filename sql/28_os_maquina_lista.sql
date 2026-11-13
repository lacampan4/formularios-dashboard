-- =====================================================================
--  OS SOLO CON MÁQUINAS DE LA LISTA (ejecutar después de 27_os_en_proceso.sql; se puede volver a ejecutar)
--  Cada ítem de la OS debe llevar una máquina de la tabla maquinas: solo el admin agrega máquinas
--  (agregar_maquina, sql/17). Los ítems ya guardados con otro nombre se quedan como están mientras
--  no les cambien la máquina.
-- =====================================================================
create or replace function public.os_item_maquina_valida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.maquina is not distinct from old.maquina then return new; end if;
  if not exists (select 1 from maquinas where nombre = new.maquina) then
    raise exception 'La máquina "%" no está en la lista. Escoja una de la lista; solo un administrador puede agregar máquinas', new.maquina;
  end if;
  return new;
end; $$;

drop trigger if exists t_maquina_valida on public.os_items;
create trigger t_maquina_valida before insert or update of maquina on public.os_items
  for each row
  execute function public.os_item_maquina_valida();

notify pgrst, 'reload schema';
