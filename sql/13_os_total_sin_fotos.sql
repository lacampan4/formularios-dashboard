-- =====================================================================
--  OS: COSTO TOTAL AUTOMÁTICO Y CIERRE SIN FOTOS (ejecutar después de 12_os_firmas_items.sql; se puede volver a ejecutar)
--  - Al guardar un ítem, costo_total = cantidad × costo_unitario (sin costo unitario queda vacío).
--    Solo al crear: los ítems ya guardados conservan el total que se escribió a mano.
--  - La OS se cierra con todos los ítems firmados (entrega y recibido); ya no pide foto.
--    Las fotos que ya se subieron se quedan en el bucket fotos-os, pero la app ya no las muestra.
-- =====================================================================
create or replace function public.calcular_costo_total()
returns trigger language plpgsql set search_path = public as $$
begin
  new.costo_total := round(new.cantidad * new.costo_unitario, 2);
  return new;
end; $$;
-- Trigger: no se llama directo (Security Advisor, igual que en 10_permisos_funciones.sql)
revoke execute on function public.calcular_costo_total() from public, anon, authenticated;

drop trigger if exists calcular_costo_total on public.os_items;
create trigger calcular_costo_total before insert on public.os_items
  for each row execute function public.calcular_costo_total();

create or replace function public.cerrar_os(os bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from ordenes_suministro where id = os and responsable = auth.uid() and estado = 'Abierta') then
    raise exception 'Solo el responsable puede cerrar esta orden y debe estar abierta';
  end if;
  if exists (select 1 from os_items where os_id = os and not entregado) then
    raise exception 'Faltan ítems por entregar y recibir: cada ítem necesita las dos firmas antes de cerrar la orden';
  end if;
  update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = os;
end; $$;
