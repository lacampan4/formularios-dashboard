-- =====================================================================
--  PROVEEDOR POR ÍTEM EN LA OS (ejecutar después de 14_os_correcciones.sql; se puede volver a ejecutar)
--  Cada ítem puede llevar su proveedor (opcional). Se guarda al crear la OS y se puede corregir
--  con corregir_item(), igual que los demás datos del ítem.
-- =====================================================================
alter table public.os_items add column if not exists proveedor text;

-- Igual que en 11_os_costos.sql, más el proveedor (el costo total lo recalcula el trigger de 13)
create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, responsable)
  select r.area_solicitante, r.prioridad, r.ot_id, r.responsable
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, costo_unitario, costo_total, proveedor, descripcion, funcion)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.costo_unitario, i.costo_total, nullif(btrim(i.proveedor), ''), i.descripcion, i.funcion
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;

-- Igual que en 14_os_correcciones.sql, con proveedor entre los campos que se pueden corregir
create or replace function public.corregir_item(item bigint, tipo text, detalle text, cambios jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  campos text[] := array['maquina', 'referencia', 'marca', 'codigo', 'cantidad', 'medida', 'costo_unitario', 'proveedor', 'descripcion', 'funcion'];
  viejo os_items; nuevo os_items; a jsonb; d jsonb;
begin
  select i.* into viejo from os_items i join ordenes_suministro o on o.id = i.os_id
    where i.id = item and o.creado_por = auth.uid() for update of i;
  if not found then raise exception 'Solo quien pidió la orden puede corregir sus ítems'; end if;
  -- Solo los campos permitidos; los que no llegan quedan como estaban
  nuevo := jsonb_populate_record(viejo, (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(cambios) e(k, v) where k = any(campos)));
  -- El total se recalcula si cambió la cantidad o el unitario; si no, se conserva (puede venir de antes de 13)
  if nuevo.cantidad is distinct from viejo.cantidad or nuevo.costo_unitario is distinct from viejo.costo_unitario then
    nuevo.costo_total := round(nuevo.cantidad * nuevo.costo_unitario, 2);
  end if;
  select coalesce(jsonb_object_agg(k, to_jsonb(viejo) -> k), '{}'), coalesce(jsonb_object_agg(k, to_jsonb(nuevo) -> k), '{}') into a, d
    from unnest(campos || 'costo_total'::text) k where to_jsonb(viejo) -> k is distinct from to_jsonb(nuevo) -> k;
  update os_items set maquina = nuevo.maquina, referencia = nuevo.referencia, marca = nuevo.marca, codigo = nuevo.codigo,
    cantidad = nuevo.cantidad, medida = nuevo.medida, costo_unitario = nuevo.costo_unitario, costo_total = nuevo.costo_total,
    proveedor = nuevo.proveedor, descripcion = nuevo.descripcion, funcion = nuevo.funcion
    where id = item;
  insert into os_correcciones (item_id, tipo, detalle, antes, despues) values (item, tipo, btrim(detalle), a, d);
end; $$;

-- Que la API de Supabase (PostgREST) vea ya la columna nueva
notify pgrst, 'reload schema';
