-- =====================================================================
--  COSTOS EN LA OS (ejecutar después de 10_permisos_funciones.sql; se puede volver a ejecutar)
--  Cada ítem lleva costo unitario y costo total, los dos escritos por la persona (opcionales:
--  quien pide no siempre los sabe). Los ítems guardados antes quedan sin costo.
-- =====================================================================

alter table public.os_items add column if not exists costo_unitario numeric check (costo_unitario >= 0);

-- Una versión anterior de este script calculaba costo_total solo; ahora lo escribe la persona.
-- Quitar el cálculo conserva los valores que ya había.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_items'
             and column_name = 'costo_total' and is_generated = 'ALWAYS') then
    alter table public.os_items alter column costo_total drop expression;
  end if;
end $$;
alter table public.os_items add column if not exists costo_total numeric;
alter table public.os_items drop constraint if exists os_items_costo_total_check;
alter table public.os_items add constraint os_items_costo_total_check check (costo_total >= 0);

-- Igual que en 7_os_fotos.sql, más los costos
create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, responsable)
  select r.area_solicitante, r.prioridad, r.ot_id, r.responsable
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, costo_unitario, costo_total, descripcion, funcion)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.costo_unitario, i.costo_total, i.descripcion, i.funcion
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;
