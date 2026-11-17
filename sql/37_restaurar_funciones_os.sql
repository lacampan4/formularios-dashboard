-- =====================================================================
--  RESTAURAR crear_os Y corregir_item (se puede ejecutar cuando sea; no cambia datos)
--  Si se vuelve a ejecutar un SQL viejo (por ejemplo 15_os_proveedor.sql), crear_os y corregir_item quedan
--  en su versión vieja: la OS no guarda stock ni toma la función como descripción, y el responsable no
--  puede llenar costo y proveedor. Este script las deja en su versión actual (de 34 y 22) sin tocar lo demás.
-- =====================================================================

-- crear_os: igual que en 34_os_sin_descripcion.sql
create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  if exists (select 1 from jsonb_populate_recordset(null::os_items, items) i
             where coalesce(nullif(btrim(i.descripcion), ''), nullif(btrim(i.funcion), '')) is null) then
    raise exception 'Escriba la función de cada ítem (qué es y para qué se usa)';
  end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, responsable)
  select r.area_solicitante, r.prioridad, r.ot_id, r.responsable
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, costo_unitario, costo_total, proveedor, descripcion, funcion, stock)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.costo_unitario, i.costo_total, nullif(btrim(i.proveedor), ''),
         coalesce(nullif(btrim(i.descripcion), ''), btrim(i.funcion)), nullif(btrim(i.funcion), ''), coalesce(i.stock, false)
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;

-- corregir_item: igual que en 22_os_responsable.sql
create or replace function public.corregir_item(item bigint, tipo text, detalle text, cambios jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  campos text[] := array['maquina', 'referencia', 'marca', 'codigo', 'cantidad', 'medida', 'costo_unitario', 'proveedor', 'descripcion', 'funcion'];
  viejo os_items; nuevo os_items; a jsonb; d jsonb; o ordenes_suministro;
begin
  select i.* into viejo from os_items i join ordenes_suministro s on s.id = i.os_id
    where i.id = item and auth.uid() in (s.creado_por, s.responsable) for update of i;
  if not found then raise exception 'Solo quien pidió la orden o su responsable pueden corregir sus ítems'; end if;
  select * into o from ordenes_suministro where id = viejo.os_id;
  if o.creado_por is distinct from auth.uid() then tipo := 'Ajuste del responsable';
  elsif tipo = 'Ajuste del responsable' then raise exception 'Escoja si fue mal diligenciado o mal entregado'; end if;
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

notify pgrst, 'reload schema';
