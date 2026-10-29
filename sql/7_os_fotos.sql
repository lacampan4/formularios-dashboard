-- =====================================================================
--  OS EN LA BANDEJA CON FOTO DE CIERRE (ejecutar después de 6_consecutivos.sql; se puede volver a ejecutar)
--  La OS ya no lleva firmas: el solicitante es quien la crea y llega a la bandeja del responsable.
--  El responsable adjunta una o más fotos (bucket "fotos-os", carpeta = id de la OS) y solo con foto la cierra.
--  Las firmas de las OS viejas se conservan con lo que tenían.
-- =====================================================================

alter table public.ordenes_suministro add column if not exists responsable uuid references public.usuarios(id);
alter table public.ordenes_suministro drop constraint if exists os_con_responsable;
alter table public.ordenes_suministro add constraint os_con_responsable check (responsable is not null) not valid;

-- Igual que la OT: se abre al crearla y se cierra con cerrar_os()
drop trigger if exists t1_preparar on public.ordenes_suministro;
create trigger t1_preparar before insert or update on public.ordenes_suministro
for each row execute function public.preparar_ot();
drop policy if exists "firmar" on public.ordenes_suministro;
revoke update on public.ordenes_suministro from authenticated;

create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, responsable)
  select r.area_solicitante, r.prioridad, r.ot_id, r.responsable
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, descripcion, funcion)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.descripcion, i.funcion
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;

-- El responsable ve la OS y sus ítems
drop policy if exists "leer" on public.ordenes_suministro;
create policy "leer" on public.ordenes_suministro for select to authenticated
  using (creado_por = auth.uid() or responsable = auth.uid() or public.es_admin());
drop policy if exists "bandeja" on public.os_items;
create policy "bandeja" on public.os_items for select to authenticated
  using (exists (select 1 from public.ordenes_suministro o where o.id = os_id and o.responsable = auth.uid()));

-- ---------- FOTOS (Supabase Storage) ----------
-- Privado; la app comprime a JPEG antes de subir, y aquí se rechaza lo que pase de 1 MB o no sea JPEG
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-os', 'fotos-os', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

-- Sube fotos solo el responsable y mientras la OS esté abierta. Sin update ni delete: la prueba no se cambia ni se borra.
drop policy if exists "fotos_os_subir" on storage.objects;
create policy "fotos_os_subir" on storage.objects for insert to authenticated with check (
  bucket_id = 'fotos-os' and exists (select 1 from public.ordenes_suministro o
    where o.id::text = (storage.foldername(name))[1] and o.responsable = auth.uid() and o.estado = 'Abierta'));
drop policy if exists "fotos_os_ver" on storage.objects;
create policy "fotos_os_ver" on storage.objects for select to authenticated using (
  bucket_id = 'fotos-os' and exists (select 1 from public.ordenes_suministro o
    where o.id::text = (storage.foldername(name))[1] and (o.responsable = auth.uid() or public.es_admin())));

-- security definer: cierra sin abrir permisos de edición y mira las fotos aunque el usuario no lea storage directo
create or replace function public.cerrar_os(os bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from ordenes_suministro where id = os and responsable = auth.uid() and estado = 'Abierta') then
    raise exception 'Solo el responsable puede cerrar esta orden y debe estar abierta';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'fotos-os' and (storage.foldername(name))[1] = os::text) then
    raise exception 'Adjunte al menos una foto como prueba antes de cerrar la orden';
  end if;
  update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = os;
end; $$;
revoke execute on function public.cerrar_os(bigint) from public, anon;
grant execute on function public.cerrar_os(bigint) to authenticated;
