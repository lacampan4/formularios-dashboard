-- =====================================================================
--  ROLES (ejecutar después de 1_esquema.sql y 2_semillas.sql; se puede volver a ejecutar)
--  Cada rol diligencia sus formatos; solo "admin" ve el dashboard y completa firmas.
--  El rol se asigna en Table Editor > usuarios > rol. Usuario nuevo = 'sin_rol' (no puede hacer nada).
-- =====================================================================

alter table public.usuarios add column if not exists rol text not null default 'sin_rol'
  check (rol in ('admin','produccion','mantenimiento','abastecimiento','sst','sin_rol'));

-- Qué formato diligencia cada rol (admin puede todos). Se puede ajustar en Table Editor > rol_formatos.
create table if not exists public.rol_formatos (
  rol     text not null check (rol in ('produccion','mantenimiento','abastecimiento','sst')),
  formato text not null check (formato in ('OT','OS','ATS','PERMISO')),
  primary key (rol, formato)
);
insert into public.rol_formatos (rol, formato) values
  ('produccion','OT'), ('produccion','OS'),
  ('mantenimiento','OT'), ('mantenimiento','OS'), ('mantenimiento','ATS'), ('mantenimiento','PERMISO'),
  ('abastecimiento','OS'),
  ('sst','ATS'), ('sst','PERMISO')
on conflict do nothing;

-- security definer: leen usuarios/rol_formatos sin depender de las políticas de esas tablas
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select rol::text from usuarios where id = auth.uid()), 'sin_rol');  -- ::text: rol puede ser lista (4_lista_roles.sql)
$$;
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select mi_rol() = 'admin';
$$;
create or replace function public.puede(f text) returns boolean
language sql stable security definer set search_path = public as $$
  select mi_rol() = 'admin' or exists (select 1 from rol_formatos where rol = mi_rol() and formato = f);
$$;
revoke execute on function public.mi_rol(), public.es_admin(), public.puede(text) from public, anon;
grant execute on function public.mi_rol(), public.es_admin(), public.puede(text) to authenticated;

-- La regla 6 debe ver ATS y permisos aunque quien firma no tenga acceso de lectura a ellos
alter function public.validar_alto_riesgo() security definer;

-- ---------- POLÍTICAS (reemplazan las de 1_esquema.sql) ----------
alter table public.rol_formatos enable row level security;
revoke all on public.rol_formatos from anon, authenticated;
grant select on public.rol_formatos to authenticated;

do $$
declare t text;
begin
  foreach t in array array['codigos_falla','usuarios','rol_formatos','ordenes_trabajo','ot_lineas','ordenes_suministro',
                           'os_items','ats','ats_trabajadores','ats_pasos','permisos_trabajo'] loop
    execute format('drop policy if exists "leer" on public.%I', t);
    execute format('drop policy if exists "crear" on public.%I', t);
    execute format('drop policy if exists "firmar" on public.%I', t);
  end loop;
end $$;

create policy "leer" on public.codigos_falla for select to authenticated using (true);
create policy "leer" on public.rol_formatos  for select to authenticated using (true);
-- Solo su propio perfil: llamar es_admin() aquí haría que la política se consulte a sí misma
create policy "leer" on public.usuarios      for select to authenticated using (id = auth.uid());

-- OT: todos los que tienen rol la ven (para vincular OS, ATS y Permiso); crean solo los roles con OT
create policy "leer"   on public.ordenes_trabajo for select to authenticated using (public.mi_rol() <> 'sin_rol');
create policy "crear"  on public.ordenes_trabajo for insert to authenticated with check (creado_por = auth.uid() and public.puede('OT'));
create policy "firmar" on public.ordenes_trabajo for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "leer"   on public.ot_lineas for select to authenticated using (public.es_admin());
create policy "crear"  on public.ot_lineas for insert to authenticated with check (public.puede('OT')
  and exists (select 1 from public.ordenes_trabajo o where o.id = ot_id and o.creado_por = auth.uid()));

-- OS
create policy "leer"   on public.ordenes_suministro for select to authenticated using (creado_por = auth.uid() or public.es_admin());
create policy "crear"  on public.ordenes_suministro for insert to authenticated with check (creado_por = auth.uid() and public.puede('OS'));
create policy "firmar" on public.ordenes_suministro for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "leer"   on public.os_items for select to authenticated using (public.es_admin());
create policy "crear"  on public.os_items for insert to authenticated with check (public.puede('OS')
  and exists (select 1 from public.ordenes_suministro o where o.id = os_id and o.creado_por = auth.uid()));

-- ATS: lo ven quienes llenan ATS o Permiso (el Permiso se vincula a un ATS)
create policy "leer"  on public.ats for select to authenticated using (public.puede('ATS') or public.puede('PERMISO'));
create policy "crear" on public.ats for insert to authenticated with check (creado_por = auth.uid() and public.puede('ATS'));
create policy "leer"  on public.ats_trabajadores for select to authenticated using (public.es_admin());
create policy "crear" on public.ats_trabajadores for insert to authenticated with check (public.puede('ATS')
  and exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));
create policy "leer"  on public.ats_pasos for select to authenticated using (public.es_admin());
create policy "crear" on public.ats_pasos for insert to authenticated with check (public.puede('ATS')
  and exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));

-- Permiso
create policy "leer"  on public.permisos_trabajo for select to authenticated using (creado_por = auth.uid() or public.es_admin());
create policy "crear" on public.permisos_trabajo for insert to authenticated with check (creado_por = auth.uid() and public.puede('PERMISO'));

-- ---------- DASHBOARD SOLO PARA ADMIN ----------
create or replace view public.v_ordenes with (security_invoker = true) as
  select 'OT' as formato, id, numero, creado_en, prioridad, estado, cerrada_en, maquina as detalle,
         autorizado_por, entregado_por, recibido_por, riesgo_personas, alto_riesgo
  from public.ordenes_trabajo where public.es_admin()
  union all
  select 'OS', id, numero, creado_en, prioridad, estado, cerrada_en, area_solicitante,
         autorizado_por, entregado_por, recibido_por, false, false
  from public.ordenes_suministro where public.es_admin();

create or replace view public.v_fallas with (security_invoker = true) as
  select o.creado_en, o.prioridad, o.maquina, l.codigo_falla, c.descripcion
  from public.ot_lineas l
  join public.ordenes_trabajo o on o.id = l.ot_id
  join public.codigos_falla c on c.codigo = l.codigo_falla
  where public.es_admin();
