-- =====================================================================
--  CORRECCIONES DE ÍTEMS DE LA OS (ejecutar después de 13_os_total_sin_fotos.sql; se puede volver a ejecutar)
--  Quien pidió la OS puede corregir un ítem, abierta o cerrada, y dice por qué:
--    - 'Mal diligenciado': se escribió mal en el formulario,
--    - 'Mal entregado': lo que se entregó no era lo pedido.
--  Con cada corrección escribe qué estaba mal y cuál fue el cambio. El ítem queda con los datos nuevos y
--  los anteriores quedan en el historial (antes / después), con quién y cuándo. El historial no se edita ni se borra.
--  Las firmas de entrega y recibido se conservan.
-- =====================================================================

create table if not exists public.os_correcciones (
  id      bigint generated always as identity primary key,
  item_id bigint not null references public.os_items(id),
  tipo    text not null check (tipo in ('Mal diligenciado', 'Mal entregado')),
  detalle text not null check (btrim(detalle) <> '' and length(detalle) <= 500),
  antes   jsonb not null default '{}',   -- solo los campos que cambiaron
  despues jsonb not null default '{}',
  por     uuid not null default auth.uid() references public.usuarios(id),
  en      timestamptz not null default now()
);
alter table public.os_correcciones enable row level security;
revoke all on public.os_correcciones from anon, authenticated;
grant select on public.os_correcciones to authenticated;   -- se escribe solo con corregir_item()

-- La ven el admin, el responsable y el solicitante de la OS
drop policy if exists "leer" on public.os_correcciones;
create policy "leer" on public.os_correcciones for select to authenticated
  using (public.es_admin() or exists (select 1 from public.os_items i join public.ordenes_suministro o on o.id = i.os_id
    where i.id = item_id and auth.uid() in (o.creado_por, o.responsable)));

-- security definer: cambia el ítem sin abrir permisos de edición; quién y cuándo los pone la base
create or replace function public.corregir_item(item bigint, tipo text, detalle text, cambios jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  campos text[] := array['maquina', 'referencia', 'marca', 'codigo', 'cantidad', 'medida', 'costo_unitario', 'descripcion', 'funcion'];
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
    descripcion = nuevo.descripcion, funcion = nuevo.funcion
    where id = item;
  insert into os_correcciones (item_id, tipo, detalle, antes, despues) values (item, tipo, btrim(detalle), a, d);
end; $$;
revoke execute on function public.corregir_item(bigint, text, text, jsonb) from public, anon;
grant execute on function public.corregir_item(bigint, text, text, jsonb) to authenticated;

-- Que la API de Supabase (PostgREST) vea ya la tabla nueva y su relación con os_items
notify pgrst, 'reload schema';
