-- =====================================================================
--  OS: EL RESPONSABLE EDITA ÍTEMS Y CIERRA CON ENTREGA INCOMPLETA
--  (ejecutar después de 21_ats_vigencia.sql; se puede volver a ejecutar)
--  1. El responsable también corrige los ítems (costos, proveedor, cantidad...). Queda en el historial de
--     correcciones como "Ajuste del responsable", con lo que cambió, quién y cuándo.
--  2. Si no puede entregar todo (por ejemplo, no hay más en el almacén), el responsable cierra la OS
--     abierta diciendo por qué. Queda Cerrada con la hora y el motivo.
-- =====================================================================

-- 1. Tipo nuevo de corrección
alter table public.os_correcciones drop constraint if exists os_correcciones_tipo_check;
alter table public.os_correcciones add constraint os_correcciones_tipo_check
  check (tipo in ('Mal diligenciado', 'Mal entregado', 'Ajuste del responsable'));

-- Igual que en 15_os_proveedor.sql, pero también la corrige el responsable (su tipo lo pone la base)
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

-- 2. Cierre con entrega incompleta
alter table public.ordenes_suministro add column if not exists cierre_incompleto text
  check (cierre_incompleto is null or (btrim(cierre_incompleto) <> '' and length(cierre_incompleto) <= 500));

create or replace function public.cerrar_os_incompleta(os bigint, motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if btrim(coalesce(motivo, '')) = '' then raise exception 'Escriba por qué se cierra sin entregar todo'; end if;
  if length(motivo) > 500 then raise exception 'El motivo admite hasta 500 caracteres'; end if;
  update ordenes_suministro set estado = 'Cerrada', cerrada_en = now(), cierre_incompleto = btrim(motivo)
  where id = os and responsable = auth.uid() and estado = 'Abierta';
  if not found then raise exception 'Solo el responsable puede cerrar la orden, y solo si está abierta'; end if;
end; $$;
revoke execute on function public.cerrar_os_incompleta(bigint, text) from public, anon;
grant execute on function public.cerrar_os_incompleta(bigint, text) to authenticated;

notify pgrst, 'reload schema';
