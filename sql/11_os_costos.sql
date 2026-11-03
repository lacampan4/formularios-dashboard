-- =====================================================================
--  COSTOS EN LA OS (ejecutar después de 10_permisos_funciones.sql; se puede volver a ejecutar)
--  Cada ítem lleva costo unitario (opcional: quien pide no siempre lo sabe).
--  El costo total lo calcula la base de datos (cantidad × costo unitario): no se escribe a mano.
--  Los ítems guardados antes quedan sin costo.
-- =====================================================================

alter table public.os_items add column if not exists costo_unitario numeric check (costo_unitario >= 0);
alter table public.os_items add column if not exists costo_total numeric
  generated always as (round(cantidad * costo_unitario, 2)) stored;

-- Igual que en 7_os_fotos.sql, más el costo unitario
create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, responsable)
  select r.area_solicitante, r.prioridad, r.ot_id, r.responsable
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, costo_unitario, descripcion, funcion)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.costo_unitario, i.descripcion, i.funcion
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;
