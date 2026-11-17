-- =====================================================================
--  CONSULTA PARA TODOS (ejecutar después de 30_formatos_extra.sql; se puede volver a ejecutar)
--  Cada persona entra a Consulta y ve los tipos de formato que tiene (rol + adicionales) y, de esos,
--  solo los suyos: los que registró o en los que es responsable o solicitante. Admin ve todo; SST ve
--  todos los ATS y permisos (19 y 20). El filtro de la lista está en consulta.js.
--  Aquí solo falta que quien registró una OT vea sus reportes de falla al abrirla (antes solo el responsable).
-- =====================================================================
drop policy if exists "solicitante" on public.ot_lineas;
create policy "solicitante" on public.ot_lineas for select to authenticated
  using (exists (select 1 from public.ordenes_trabajo o where o.id = ot_id and o.creado_por = auth.uid()));

notify pgrst, 'reload schema';
