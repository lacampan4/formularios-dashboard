-- =====================================================================
--  ENTREGAS PARCIALES Y ESTADO "EN PROCESO" EN LA OS
--  (ejecutar después de 24_maquinas_galones.sql; se puede volver a ejecutar)
--  - "Firmar entrega" entrega todo lo que falta del ítem. "Entrega parcial" entrega solo una parte
--    (ej. 10 de 20 L); lo que falta queda pendiente y se entrega después, en una o varias entregas.
--  - Cada entrega queda en os_entregas: cuánto, quién y cuándo la entregó, y quién y cuándo la recibió.
--  - Con una entrega parcial la OS pasa a "En proceso". Se cierra sola cuando todos los ítems están
--    entregados completos y recibidos (como en sql/17).
--  Reemplaza la entrega con cantidad de sql/23.
-- =====================================================================

alter table public.ordenes_suministro drop constraint if exists ordenes_suministro_estado_check;
alter table public.ordenes_suministro add constraint ordenes_suministro_estado_check
  check (estado in ('Abierta', 'En proceso', 'Cerrada'));

create table if not exists public.os_entregas (
  id             bigint generated always as identity primary key,
  item_id        bigint not null references public.os_items(id),
  cantidad       numeric not null check (cantidad > 0),
  entregado_por  uuid not null default auth.uid() references public.usuarios(id),
  entregado_en   timestamptz not null default now(),
  recibido_por   uuid references public.usuarios(id),
  recibido_en    timestamptz
);
alter table public.os_entregas enable row level security;
revoke all on public.os_entregas from anon, authenticated;
grant select on public.os_entregas to authenticated;   -- se escribe solo con firmar_item()
drop policy if exists "leer" on public.os_entregas;
create policy "leer" on public.os_entregas for select to authenticated
  using (public.es_admin() or exists (select 1 from public.os_items i join public.ordenes_suministro o on o.id = i.os_id
    where i.id = item_id and auth.uid() in (o.creado_por, o.responsable)));

-- Entregas firmadas antes de este script: una entrega por ítem, con lo que se entregó
insert into public.os_entregas (item_id, cantidad, entregado_por, entregado_en, recibido_por, recibido_en)
select i.id, coalesce(i.cantidad_entregada, i.cantidad), i.entregado_por, i.entregado_en, i.recibido_por, i.recibido_en
from public.os_items i
where i.entregado_por is not null and not exists (select 1 from public.os_entregas e where e.item_id = i.id);

-- El ítem queda "entregado" (entregado_por) solo cuando ya se entregó todo lo pedido
drop function if exists public.firmar_item(bigint, text, numeric);
create function public.firmar_item(item bigint, como text, cantidad numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare i os_items; o ordenes_suministro; falta numeric; c numeric;
begin
  select * into i from os_items where id = item for update;  -- dos firmas al tiempo no se pisan
  if not found then raise exception 'Ítem no encontrado'; end if;
  select * into o from ordenes_suministro where id = i.os_id for update;
  if o.estado = 'Cerrada' then raise exception 'La % ya está cerrada', o.numero; end if;
  if como = 'entrega' then
    if o.responsable is distinct from auth.uid() then raise exception 'Solo el responsable de la % firma la entrega', o.numero; end if;
    if i.entregado_por is not null then raise exception 'Este ítem ya se entregó completo'; end if;
    falta := i.cantidad - coalesce(i.cantidad_entregada, 0);
    c := coalesce(firmar_item.cantidad, falta);   -- sin cantidad: entrega todo lo que falta
    if c <= 0 or c > falta then raise exception 'Entregue más de 0 y hasta % % (lo que falta)', falta, i.medida; end if;
    insert into os_entregas (item_id, cantidad) values (item, c);
    update os_items set cantidad_entregada = coalesce(cantidad_entregada, 0) + c,
      entregado_por = case when c = falta then auth.uid() end, entregado_en = case when c = falta then now() end
    where id = item;
    if c < falta then update ordenes_suministro set estado = 'En proceso' where id = o.id; end if;
  elsif como = 'recibe' then
    if o.creado_por is distinct from auth.uid() then raise exception 'Solo quien pidió la % firma el recibido', o.numero; end if;
    update os_entregas set recibido_por = auth.uid(), recibido_en = now() where item_id = item and recibido_por is null;
    if not found then raise exception 'No hay entregas de este ítem por recibir'; end if;
    if i.entregado_por is not null then
      update os_items set recibido_por = auth.uid(), recibido_en = now() where id = item;
    end if;
    if not exists (select 1 from os_items where os_id = o.id and not entregado) then
      update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = o.id;
    end if;
  else
    raise exception 'Firma no válida: use entrega o recibe';
  end if;
end; $$;
revoke execute on function public.firmar_item(bigint, text, numeric) from public, anon;
grant execute on function public.firmar_item(bigint, text, numeric) to authenticated;

notify pgrst, 'reload schema';
