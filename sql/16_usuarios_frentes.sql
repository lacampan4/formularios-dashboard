-- =====================================================================
--  FRENTE Y "SE ENCARGA DE" DE CADA USUARIO (ejecutar después de 15_os_proveedor.sql; se puede volver a ejecutar)
--  Guía, sección 1 "Quién es quién". Se ve junto al nombre (responsable, solicitante) y lo edita el admin
--  en usuarios.html. Los usuarios nuevos se crean desde esa página con la Edge Function crear-usuario.
-- =====================================================================

alter table public.usuarios add column if not exists frente text
  check (frente in ('Dirección', 'Producción', 'Mantenimiento', 'Abastecimiento', 'SST'));
alter table public.usuarios add column if not exists encargo text check (length(encargo) <= 120);

-- Los que se llaman igual que en la guía quedan llenos; los demás los completa el admin
update public.usuarios u set frente = g.frente, encargo = g.encargo
from (values
  ('Ivan Ibáñez', 'Dirección', 'Operación General'),
  ('Cesar Riveros', 'Producción', 'Tuberías'),
  ('Juan Carlos Sánchez', 'Producción', 'Formadoras'),
  ('Sebastián Hernández', 'Producción', 'Corte'),
  ('Andres Sanchez', 'Producción', 'Corte de vigas y corte de planchas'),
  ('Wilson García', 'Producción', 'Mecanizados'),
  ('Raúl Salazar', 'Producción', 'Mecánica de máquinas pequeñas'),
  ('Fredy Verdugo', 'Mantenimiento', 'Mecánica de CTL''s y slitters'),
  ('Jhon Lozano', 'Mantenimiento', 'Mecánica de formadoras y tuberías'),
  ('Ricardo Arcila', 'Mantenimiento', 'Parte eléctrica de todas las máquinas y varios'),
  ('Andrés Moreno', 'Abastecimiento', 'Compras especializadas o importadas'),
  ('Sofía Arévalo', 'Abastecimiento', 'Compras de insumos nacionales'),
  ('Lina Hernández', 'SST', 'Seguridad y salud en el trabajo')
) g(nombre, frente, encargo)
-- Sin tildes ni eñes: en la base están como "Ivan Ibañez" o "Juan Carlos Sanchez"
where translate(lower(btrim(u.nombre)), 'áéíóúüñ', 'aeiouun') = translate(lower(g.nombre), 'áéíóúüñ', 'aeiouun') and u.frente is null;

-- Igual que en 5_bandeja.sql, más frente y encargo (sigue sin exponer usuario ni rol)
drop function if exists public.usuarios_activos();
create function public.usuarios_activos()
returns table (id uuid, nombre text, frente text, encargo text) language sql stable security definer set search_path = public as $$
  select id, nombre, frente, encargo from usuarios where rol::text <> 'sin_rol' and public.mi_rol() <> 'sin_rol' order by nombre;
$$;
revoke execute on function public.usuarios_activos() from public, anon;
grant execute on function public.usuarios_activos() to authenticated;

-- El admin cambia nombre, rol, frente y encargo sin abrir permisos de edición sobre la tabla.
-- No puede cambiarse su propio rol: así nunca se queda la app sin administrador por error.
create or replace function public.actualizar_usuario(uid uuid, nombre text, rol text, frente text, encargo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede editar usuarios'; end if;
  if btrim(coalesce(nombre, '')) = '' then raise exception 'Escriba el nombre completo'; end if;
  if uid = auth.uid() and rol is distinct from public.mi_rol() then raise exception 'No puede cambiar su propio rol'; end if;
  update usuarios set nombre = btrim(actualizar_usuario.nombre), rol = actualizar_usuario.rol::rol_usuario,
    frente = nullif(actualizar_usuario.frente, ''), encargo = nullif(btrim(actualizar_usuario.encargo), '')
  where id = uid;
  if not found then raise exception 'Usuario no encontrado'; end if;
end; $$;
revoke execute on function public.actualizar_usuario(uuid, text, text, text, text) from public, anon;
grant execute on function public.actualizar_usuario(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
