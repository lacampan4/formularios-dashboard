-- =====================================================================
--  OS: REFERENCIA Y FUNCIÓN OBLIGATORIAS (ejecutar después de 38_ot_maquina_otro.sql; se puede volver a ejecutar)
--  Cada ítem nuevo de la OS debe traer máquina, referencia, cantidad, medida y función. Máquina, cantidad
--  y medida ya las exige la tabla (sql/1 y 28); aquí se agregan referencia y función. Va en un trigger y no
--  en un check para que los ítems viejos sin referencia se puedan seguir firmando y entregando; al
--  corregirlos (corregir_item) no se puede borrar una referencia o función que ya tengan.
-- =====================================================================
create or replace function public.os_item_obligatorios()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(btrim(new.referencia), '') = ''
     and (tg_op = 'INSERT' or coalesce(btrim(old.referencia), '') <> '') then
    raise exception 'Escriba la referencia de cada ítem';
  end if;
  if coalesce(btrim(new.funcion), '') = ''
     and (tg_op = 'INSERT' or coalesce(btrim(old.funcion), '') <> '') then
    raise exception 'Escriba la función de cada ítem (qué es y para qué se usa)';
  end if;
  return new;
end; $$;

drop trigger if exists t_obligatorios on public.os_items;
create trigger t_obligatorios before insert or update of referencia, funcion on public.os_items
  for each row
  execute function public.os_item_obligatorios();

notify pgrst, 'reload schema';
