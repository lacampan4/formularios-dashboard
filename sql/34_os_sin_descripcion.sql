-- =====================================================================
--  OS SIN DESCRIPCIÓN DEL ÍTEM (ejecutar después de 33_os_listo_recoger.sql; se puede volver a ejecutar)
--  Al pedir la OS ya no se escribe la descripción: la Función dice qué es el ítem y para qué se usa.
--  La base guarda la función también como descripción, así la bandeja, las firmas, la consulta y el Excel
--  siguen mostrando el ítem igual. Los ítems guardados antes no cambian.
-- =====================================================================

-- Igual que en 32_os_libras_stock.sql; la descripción, si no llega, es la función (que ahora es obligatoria)
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

notify pgrst, 'reload schema';
