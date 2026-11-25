-- =====================================================================
--  EL ATS VALE 24 HORAS (ejecutar después de 51_os_maquina_sst.sql; se puede volver a ejecutar)
--  El ATS ya se cierra solo a las 24 h de guardado (sql/29). Las listas de días que trae del permiso (sql/48)
--  dejaban agregar hasta el día 7 aunque el ATS estuviera cerrado: ahora en el ATS solo se agregan mientras
--  está abierto. El Permiso de Trabajo (PT) sigue igual, hasta 7 días.
-- =====================================================================
-- Igual que en 48_ats_permiso_dias.sql, más: en el ATS, solo con el ATS abierto
create or replace function public.agregar_dia(formato text, registro bigint, dia jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare d jsonb; hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if jsonb_typeof(dia) is distinct from 'object' then raise exception 'Día inválido'; end if;
  if formato = 'PT' then
    select coalesce(detalle_extra -> 'dias', '[]') into d from permisos_trabajo
    where id = registro and (creado_por = auth.uid() or ve_seguridad()) and detalle_extra ? 'dias' for update;
  elsif formato = 'ATS' then
    if exists (select 1 from ats where id = registro and estado = 'Cerrada') then
      raise exception 'El ATS ya está cerrado: vale 24 horas desde que se guardó';
    end if;
    select coalesce(permiso -> 'detalle_extra' -> 'dias', '[]') into d from ats
    where id = registro and (creado_por = auth.uid() or ve_seguridad()) and permiso -> 'detalle_extra' ? 'dias' for update;
  end if;
  if d is null then raise exception 'No puede agregar días a este formato'; end if;
  if jsonb_array_length(d) >= 7 then raise exception 'La lista ya tiene los 7 días'; end if;
  if exists (select 1 from jsonb_array_elements(d) e where e ->> 'fecha' = hoy::text) then
    raise exception 'El día de hoy ya está diligenciado';
  end if;
  d := d || jsonb_build_array(dia || jsonb_build_object('fecha', hoy, 'por', auth.uid()));
  if formato = 'PT' then
    update permisos_trabajo set detalle_extra = jsonb_set(detalle_extra, '{dias}', d) where id = registro;
  else
    update ats set permiso = jsonb_set(permiso, '{detalle_extra,dias}', d) where id = registro;
  end if;
  return jsonb_array_length(d);
end; $$;
revoke execute on function public.agregar_dia(text, bigint, jsonb) from public, anon;
grant execute on function public.agregar_dia(text, bigint, jsonb) to authenticated;

notify pgrst, 'reload schema';
