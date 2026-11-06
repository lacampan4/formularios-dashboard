-- =====================================================================
--  ESTADO DEL ATS (ejecutar después de 17_cierre_roles_maquinas.sql; se puede volver a ejecutar)
--  El ATS queda Abierto al guardarlo. Quien lo registró, al terminar la tarea, lo marca "Realizado"
--  desde su Bandeja y queda Cerrado con la hora. Las firmas del formato siguen igual.
-- =====================================================================
alter table public.ats add column if not exists estado text not null default 'Abierta';
alter table public.ats add column if not exists cerrada_en timestamptz;
alter table public.ats drop constraint if exists ats_estado_check;
alter table public.ats add constraint ats_estado_check check (estado in ('Abierta','Cerrada'));

-- Se crea siempre abierto (crear_ats inserta con los permisos de quien llama)
drop policy if exists "crear" on public.ats;
create policy "crear" on public.ats for insert to authenticated
  with check (creado_por = auth.uid() and public.puede('ATS') and estado = 'Abierta' and cerrada_en is null);

-- Quien registró el ATS ve sus trabajadores y pasos al abrirlo desde la Bandeja (antes solo el admin)
drop policy if exists "leer" on public.ats_trabajadores;
create policy "leer" on public.ats_trabajadores for select to authenticated using (public.es_admin()
  or exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));
drop policy if exists "leer" on public.ats_pasos;
create policy "leer" on public.ats_pasos for select to authenticated using (public.es_admin()
  or exists (select 1 from public.ats a where a.id = ats_id and a.creado_por = auth.uid()));

create or replace function public.cerrar_ats(ats bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ats a set estado = 'Cerrada', cerrada_en = now()
  where a.id = cerrar_ats.ats and a.creado_por = auth.uid() and a.estado = 'Abierta';
  if not found then raise exception 'Solo quien registró el ATS puede marcarlo realizado, y solo si está abierto'; end if;
end; $$;
revoke execute on function public.cerrar_ats(bigint) from public, anon;
grant execute on function public.cerrar_ats(bigint) to authenticated;

notify pgrst, 'reload schema';
