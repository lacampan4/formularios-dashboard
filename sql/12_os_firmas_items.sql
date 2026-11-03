-- =====================================================================
--  FIRMAS POR ÍTEM EN LA OS (ejecutar después de 11_os_costos.sql; se puede volver a ejecutar)
--  Cada ítem se firma por separado, cada quien con su propio usuario y a la hora real:
--    1. el responsable de la OS firma la ENTREGA del ítem,
--    2. el solicitante (quien creó la OS) firma que lo RECIBIÓ.
--  Con las dos firmas el ítem queda entregado (chuleado). La OS solo se cierra con todos sus ítems entregados.
--  Las firmas no se editan ni se borran.
-- =====================================================================

alter table public.os_items add column if not exists entregado_por uuid references public.usuarios(id);
alter table public.os_items add column if not exists entregado_en  timestamptz;
alter table public.os_items add column if not exists recibido_por  uuid references public.usuarios(id);
alter table public.os_items add column if not exists recibido_en   timestamptz;
alter table public.os_items add column if not exists entregado boolean
  generated always as (entregado_por is not null and recibido_por is not null) stored;

-- El solicitante ve los ítems de sus OS (para firmar lo que recibe)
drop policy if exists "solicitante" on public.os_items;
create policy "solicitante" on public.os_items for select to authenticated
  using (exists (select 1 from public.ordenes_suministro o where o.id = os_id and o.creado_por = auth.uid()));

-- security definer: firma sin abrir permisos de edición; quién y cuándo los pone la base, no el navegador
create or replace function public.firmar_item(item bigint, como text)
returns void language plpgsql security definer set search_path = public as $$
declare i os_items; o ordenes_suministro;
begin
  select * into i from os_items where id = item for update;  -- dos firmas al tiempo no se pisan
  if not found then raise exception 'Ítem no encontrado'; end if;
  select * into o from ordenes_suministro where id = i.os_id;
  if o.estado <> 'Abierta' then raise exception 'La % ya está cerrada', o.numero; end if;
  if como = 'entrega' then
    if o.responsable is distinct from auth.uid() then raise exception 'Solo el responsable de la % firma la entrega', o.numero; end if;
    if i.entregado_por is not null then raise exception 'La entrega de este ítem ya está firmada'; end if;
    update os_items set entregado_por = auth.uid(), entregado_en = now() where id = item;
  elsif como = 'recibe' then
    if o.creado_por is distinct from auth.uid() then raise exception 'Solo quien pidió la % firma el recibido', o.numero; end if;
    if i.entregado_por is null then raise exception 'Primero el responsable debe firmar la entrega de este ítem'; end if;
    if i.recibido_por is not null then raise exception 'El recibido de este ítem ya está firmado'; end if;
    update os_items set recibido_por = auth.uid(), recibido_en = now() where id = item;
  else
    raise exception 'Firma no válida: use entrega o recibe';
  end if;
end; $$;
revoke execute on function public.firmar_item(bigint, text) from public, anon;
grant execute on function public.firmar_item(bigint, text) to authenticated;

-- Igual que en 7_os_fotos.sql, más: todos los ítems entregados y recibidos
create or replace function public.cerrar_os(os bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from ordenes_suministro where id = os and responsable = auth.uid() and estado = 'Abierta') then
    raise exception 'Solo el responsable puede cerrar esta orden y debe estar abierta';
  end if;
  if exists (select 1 from os_items where os_id = os and not entregado) then
    raise exception 'Faltan ítems por entregar y recibir: cada ítem necesita las dos firmas antes de cerrar la orden';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'fotos-os' and (storage.foldername(name))[1] = os::text) then
    raise exception 'Adjunte al menos una foto como prueba antes de cerrar la orden';
  end if;
  update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = os;
end; $$;
