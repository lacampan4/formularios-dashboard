-- =====================================================================
--  ATS Y PERMISO EN LA OT (ejecutar después de 7_os_fotos.sql; se puede volver a ejecutar)
--  El responsable, al revisar la OT, marca si requiere ATS y/o Permiso de trabajo de alto riesgo.
--  Es su análisis: no obliga a nada ni impide cerrar la OT.
-- =====================================================================

alter table public.ordenes_trabajo add column if not exists requiere_ats     boolean not null default false;
alter table public.ordenes_trabajo add column if not exists requiere_permiso boolean not null default false;

-- security definer: solo el responsable y con la OT abierta, sin abrir permisos de edición sobre la tabla
create or replace function public.marcar_requisitos_ot(ot bigint, ats boolean, permiso boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ordenes_trabajo set requiere_ats = ats, requiere_permiso = permiso
  where id = ot and responsable = auth.uid() and estado = 'Abierta';
  if not found then raise exception 'Solo el responsable puede marcar esto y la orden debe estar abierta'; end if;
end; $$;
revoke execute on function public.marcar_requisitos_ot(bigint, boolean, boolean) from public, anon;
grant execute on function public.marcar_requisitos_ot(bigint, boolean, boolean) to authenticated;
