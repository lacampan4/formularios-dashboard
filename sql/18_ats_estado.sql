-- =====================================================================
--  ESTADO DEL ATS (ejecutar después de 17_cierre_roles_maquinas.sql; se puede volver a ejecutar)
--  El ATS queda Abierto al guardarlo y se cierra solo, a la misma hora, cuando se cierra la OT
--  a la que está enlazado. Las firmas del formato siguen igual.
-- =====================================================================
alter table public.ats add column if not exists estado text not null default 'Abierta';
alter table public.ats add column if not exists cerrada_en timestamptz;
alter table public.ats drop constraint if exists ats_estado_check;
alter table public.ats add constraint ats_estado_check check (estado in ('Abierta','Cerrada'));

-- La primera versión de este script cerraba el ATS con un botón "Realizado"
drop function if exists public.cerrar_ats(bigint);
drop policy if exists "crear" on public.ats;
create policy "crear" on public.ats for insert to authenticated with check (creado_por = auth.uid() and public.puede('ATS'));

-- Al crearlo, el estado lo pone la base: abierto, o ya cerrado si su OT está cerrada
create or replace function public.preparar_ats()
returns trigger language plpgsql security definer set search_path = public as $$
declare o ordenes_trabajo;
begin
  select * into o from ordenes_trabajo where id = new.ot_id;
  new.estado := case when o.estado = 'Cerrada' then 'Cerrada' else 'Abierta' end;
  new.cerrada_en := case when o.estado = 'Cerrada' then o.cerrada_en end;
  return new;
end; $$;
drop trigger if exists t1_preparar on public.ats;
create trigger t1_preparar before insert on public.ats for each row execute function public.preparar_ats();

-- Al cerrarse la OT (por cualquier camino) se cierran sus ATS abiertos con la misma hora
create or replace function public.cerrar_ats_de_ot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update ats set estado = 'Cerrada', cerrada_en = new.cerrada_en where ot_id = new.id and estado = 'Abierta';
  return null;
end; $$;
drop trigger if exists t3_cerrar_ats on public.ordenes_trabajo;
create trigger t3_cerrar_ats after update on public.ordenes_trabajo
  for each row when (new.estado = 'Cerrada' and old.estado is distinct from 'Cerrada') execute function public.cerrar_ats_de_ot();

revoke execute on function public.preparar_ats(), public.cerrar_ats_de_ot() from public, anon, authenticated;

-- ATS guardados antes de este script cuya OT ya está cerrada
update public.ats a set estado = 'Cerrada', cerrada_en = o.cerrada_en
from public.ordenes_trabajo o where o.id = a.ot_id and o.estado = 'Cerrada' and a.estado = 'Abierta';

-- Quien registró el ATS ve sus trabajadores y pasos al abrirlo (antes solo el admin)
drop policy if exists "leer" on public.ats_trabajadores;
create policy "leer" on public.ats_trabajadores for select to authenticated using (public.es_admin()
  or exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));
drop policy if exists "leer" on public.ats_pasos;
create policy "leer" on public.ats_pasos for select to authenticated using (public.es_admin()
  or exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));

notify pgrst, 'reload schema';
