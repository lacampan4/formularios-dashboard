-- =====================================================================
--  OS: LIBRAS Y CASILLA DE STOCK (ejecutar después de 31_consulta_todos.sql; se puede volver a ejecutar)
--   1. Los ítems se pueden pedir en libras (lb), además de und, kg, m, L y gal.
--   2. Cada ítem trae la casilla "Stock", que marca quien pide la OS al registrarla (por defecto, sin marcar).
-- =====================================================================
alter table public.os_items drop constraint if exists os_items_medida_check;
alter table public.os_items add constraint os_items_medida_check check (medida in ('und', 'kg', 'm', 'L', 'gal', 'lb'));

alter table public.os_items add column if not exists stock boolean not null default false;

-- Igual que en 15_os_proveedor.sql, más la casilla de stock
create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, responsable)
  select r.area_solicitante, r.prioridad, r.ot_id, r.responsable
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, costo_unitario, costo_total, proveedor, descripcion, funcion, stock)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.costo_unitario, i.costo_total, nullif(btrim(i.proveedor), ''),
         i.descripcion, i.funcion, coalesce(i.stock, false)
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;

notify pgrst, 'reload schema';
