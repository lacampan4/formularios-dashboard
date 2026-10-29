-- =====================================================================
--  BANDEJA DE ENTRADA DE LA OT (ejecutar después de 4_lista_roles.sql; se puede volver a ejecutar)
--  La OT ya no lleva firmas: el solicitante es quien la crea (creado_por) y llega a la bandeja
--  del responsable, que la cierra. Riesgo para personas y alto riesgo ya no se piden.
--  Las columnas viejas (firmas, hora_evento, riesgos) se conservan con lo que tenían.
-- =====================================================================

alter table public.ordenes_trabajo add column if not exists responsable uuid references public.usuarios(id);
-- not valid: obliga en las OT nuevas sin tocar las viejas, que no tienen responsable
alter table public.ordenes_trabajo drop constraint if exists ot_con_responsable;
alter table public.ordenes_trabajo add constraint ot_con_responsable check (responsable is not null) not valid;
alter table public.ot_lineas drop constraint if exists reporte_500;
alter table public.ot_lineas add constraint reporte_500 check (char_length(reporte) <= 500) not valid;

-- La OT ya no se cierra con firmas: se abre al crearla y la cierra el responsable con cerrar_ot()
create or replace function public.preparar_ot()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.creado_en := now(); new.estado := 'Abierta'; new.cerrada_en := null; end if;
  return new;
end; $$;
drop trigger if exists t1_preparar on public.ordenes_trabajo;
create trigger t1_preparar before insert or update on public.ordenes_trabajo
for each row execute function public.preparar_ot();
drop trigger if exists t2_alto_riesgo on public.ordenes_trabajo;

-- Nadie edita la OT directamente; el admin sigue firmando solo la OS
drop policy if exists "firmar" on public.ordenes_trabajo;
revoke update on public.ordenes_trabajo from authenticated;

create or replace function public.crear_ot(orden jsonb, lineas jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_trabajo;
begin
  if coalesce(jsonb_array_length(lineas), 0) = 0 then raise exception 'La OT necesita al menos un código y reporte de falla'; end if;
  insert into ordenes_trabajo (maquina, prioridad, responsable)
  select r.maquina, r.prioridad, r.responsable
  from jsonb_populate_record(null::ordenes_trabajo, orden) r
  returning * into o;
  insert into ot_lineas (ot_id, codigo_falla, reporte)
  select o.id, l.codigo_falla, l.reporte from jsonb_populate_recordset(null::ot_lineas, lineas) l;
  return o.numero;
end; $$;

-- security definer: solo el responsable cierra su OT, sin abrir permisos de edición sobre la tabla
create or replace function public.cerrar_ot(ot bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_trabajo set estado = 'Cerrada', cerrada_en = now()
  where id = ot and responsable = auth.uid() and estado = 'Abierta';
  if not found then raise exception 'Solo el responsable puede cerrar esta orden y debe estar abierta'; end if;
end; $$;

-- Nombres para escoger responsable y ver el solicitante, sin exponer usuario ni rol de los demás
create or replace function public.usuarios_activos()
returns table (id uuid, nombre text) language sql stable security definer set search_path = public as $$
  select id, nombre from usuarios where rol::text <> 'sin_rol' and public.mi_rol() <> 'sin_rol' order by nombre;
$$;

-- Código de falla nuevo (solo admin): queda en la lista para todos. Si ya existe con esa descripción, devuelve ese.
create or replace function public.agregar_codigo(descripcion text)
returns smallint language plpgsql security definer set search_path = public as $$
declare d text := btrim(descripcion); c smallint;
begin
  if not public.es_admin() then raise exception 'Solo la Dirección de Operaciones puede agregar códigos de falla'; end if;
  if d = '' or char_length(d) > 100 then raise exception 'La descripción del código debe tener entre 1 y 100 caracteres'; end if;
  lock table codigos_falla in exclusive mode;  -- dos códigos al tiempo no toman el mismo número
  select codigo into c from codigos_falla where lower(codigos_falla.descripcion) = lower(d);
  if c is null then
    insert into codigos_falla (codigo, descripcion) select coalesce(max(codigo), 0) + 1, d from codigos_falla returning codigo into c;
  end if;
  return c;
end; $$;

-- El responsable ve los códigos y reportes de las OT de su bandeja
drop policy if exists "bandeja" on public.ot_lineas;
create policy "bandeja" on public.ot_lineas for select to authenticated
  using (exists (select 1 from public.ordenes_trabajo o where o.id = ot_id and o.responsable = auth.uid()));

revoke execute on function public.cerrar_ot(bigint), public.usuarios_activos(), public.agregar_codigo(text) from public, anon;
grant execute on function public.cerrar_ot(bigint), public.usuarios_activos(), public.agregar_codigo(text) to authenticated;
