-- =====================================================================
--  CORREGIR LA CANTIDAD PEDIDA CIERRA LO QUE YA ESTÁ COMPLETO
--  (ejecutar después de 44_os_firma_abierta.sql; se puede volver a ejecutar)
--  Si pidieron 6 y solo hay 1, quien pidió (o el responsable) corrige la cantidad a 1 con "Corregir"/"Editar".
--  Antes el ítem seguía "Parcial: 1 de 6" para siempre: entregado_por solo se ponía al firmar la entrega.
--  Ahora, al cambiar la cantidad, la base recalcula si el ítem quedó entregado y recibido, y si era lo
--  último, la OS se cierra sola como con el último recibido.
-- =====================================================================
create or replace function public.os_item_recalcular_cantidad()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cantidad is not distinct from old.cantidad then return new; end if;
  if new.cantidad_entregada > new.cantidad then
    raise exception 'Ya se entregaron % %: la cantidad no puede ser menor', trim_scale(new.cantidad_entregada), new.medida;
  end if;
  if new.cantidad_entregada = new.cantidad then
    -- Completo: la entrega la firma quien hizo la última entrega; el recibido, si ya recibieron todas
    if new.entregado_por is null then
      select entregado_por, entregado_en into new.entregado_por, new.entregado_en
      from os_entregas where item_id = new.id order by id desc limit 1;
    end if;
    if new.recibido_por is null and not exists (select 1 from os_entregas where item_id = new.id and recibido_por is null) then
      select recibido_por, recibido_en into new.recibido_por, new.recibido_en
      from os_entregas where item_id = new.id order by recibido_en desc limit 1;
    end if;
  else
    -- Pidieron más de lo entregado: vuelve a estar pendiente
    new.entregado_por := null; new.entregado_en := null; new.recibido_por := null; new.recibido_en := null;
  end if;
  return new;
end; $$;

create or replace function public.os_cerrar_si_completa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entregado and not old.entregado and not exists (select 1 from os_items where os_id = new.os_id and not entregado) then
    update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = new.os_id and estado <> 'Cerrada';
  end if;
  return null;
end; $$;
-- Triggers: no se llaman directo (Security Advisor)
revoke execute on function public.os_item_recalcular_cantidad(), public.os_cerrar_si_completa() from public, anon, authenticated;

drop trigger if exists t_recalcular_cantidad on public.os_items;
create trigger t_recalcular_cantidad before update of cantidad on public.os_items
  for each row execute function public.os_item_recalcular_cantidad();
drop trigger if exists t_cerrar_si_completa on public.os_items;
create trigger t_cerrar_si_completa after update of cantidad on public.os_items
  for each row execute function public.os_cerrar_si_completa();

notify pgrst, 'reload schema';
