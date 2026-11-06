-- =====================================================================
--  CIERRE AUTOMÁTICO DE LA OS, ROLES/FRENTES NUEVOS Y MÁQUINAS (ejecutar después de 16_usuarios_frentes.sql;
--  se puede volver a ejecutar)
--  1. La OS se cierra sola cuando quien la pidió firma el recibido del último ítem pendiente (guarda la hora).
--  2. El admin crea roles nuevos con sus formatos (OT, OS, ATS, Permiso), y frentes y encargos nuevos.
--  3. Las máquinas de la OT salen de la tabla maquinas; el admin agrega nuevas y todos las ven.
-- =====================================================================

-- ---------- 1. CIERRE AUTOMÁTICO DE LA OS ----------
-- Igual que en 12_os_firmas_items.sql, más: con el último recibido la OS queda Cerrada a esa hora
create or replace function public.firmar_item(item bigint, como text)
returns void language plpgsql security definer set search_path = public as $$
declare i os_items; o ordenes_suministro;
begin
  select * into i from os_items where id = item for update;  -- dos firmas al tiempo no se pisan
  if not found then raise exception 'Ítem no encontrado'; end if;
  select * into o from ordenes_suministro where id = i.os_id for update;
  if o.estado <> 'Abierta' then raise exception 'La % ya está cerrada', o.numero; end if;
  if como = 'entrega' then
    if o.responsable is distinct from auth.uid() then raise exception 'Solo el responsable de la % firma la entrega', o.numero; end if;
    if i.entregado_por is not null then raise exception 'La entrega de este ítem ya está firmada'; end if;
    update os_items set entregado_por = auth.uid(), entregado_en = now() where id = item;
  elsif como = 'recibe' then
    if o.creado_por is distinct from auth.uid() then raise exception 'Solo quien pidió la % firma el recibido', o.numero; end if;
    if i.entregado_por is null then raise exception 'Primero el responsable debe firmar la entrega de este ítem'; end if;
    if i.recibido_por is not null then raise exception 'El recibido de este ítem ya está firmado'; end if;
    update os_items set recibido_por = auth.uid(), recibido_en = now() where id = item;
    if not exists (select 1 from os_items where os_id = o.id and not entregado) then
      update ordenes_suministro set estado = 'Cerrada', cerrada_en = now() where id = o.id;
    end if;
  else
    raise exception 'Firma no válida: use entrega o recibe';
  end if;
end; $$;

-- ---------- 2. ROLES, FRENTES Y ENCARGOS NUEVOS ----------
-- Un rol nuevo entra a la lista de roles (rol_usuario) y a rol_formatos con los formatos que puede llenar
alter table public.rol_formatos drop constraint if exists rol_formatos_rol_check;
alter table public.usuarios drop constraint if exists usuarios_frente_check;  -- el admin puede escribir frentes nuevos
alter table public.usuarios drop constraint if exists usuarios_frente_largo;
alter table public.usuarios add constraint usuarios_frente_largo check (length(frente) <= 60);

-- Roles que existen y qué formatos llena cada uno (admin: todos, sin_rol: ninguno)
create or replace function public.roles_disponibles()
returns table (rol text, formatos text[]) language sql stable set search_path = public as $$
  select r::text, coalesce(array_agg(f.formato order by f.formato) filter (where f.formato is not null), '{}')
  from unnest(enum_range(null::rol_usuario)) r left join rol_formatos f on f.rol = r::text
  group by r order by r::text;
$$;
revoke execute on function public.roles_disponibles() from public, anon;
grant execute on function public.roles_disponibles() to authenticated, service_role;

create or replace function public.crear_rol(nombre text, formatos text[])
returns text language plpgsql security definer set search_path = public as $$
declare r text := regexp_replace(translate(lower(btrim(nombre)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '_', 'g');
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede crear roles'; end if;
  r := btrim(r, '_');
  if r !~ '^[a-z][a-z0-9_]{2,29}$' then raise exception 'El rol debe tener de 3 a 30 letras o números'; end if;
  if r = any(enum_range(null::rol_usuario)::text[]) then raise exception 'Ya existe el rol %', r; end if;
  if coalesce(cardinality(formatos), 0) = 0 or not formatos <@ array['OT','OS','ATS','PERMISO'] then
    raise exception 'Escoja a qué formatos tiene acceso el rol (OT, OS, ATS, Permiso)';
  end if;
  execute format('alter type public.rol_usuario add value %L', r);
  insert into rol_formatos (rol, formato) select r, unnest(formatos) on conflict do nothing;
  return r;
end; $$;
revoke execute on function public.crear_rol(text, text[]) from public, anon;
grant execute on function public.crear_rol(text, text[]) to authenticated;

-- Igual que en 16_usuarios_frentes.sql: el frente ahora es texto libre (sin espacios sobrantes)
create or replace function public.actualizar_usuario(uid uuid, nombre text, rol text, frente text, encargo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede editar usuarios'; end if;
  if btrim(coalesce(nombre, '')) = '' then raise exception 'Escriba el nombre completo'; end if;
  if uid = auth.uid() and rol is distinct from public.mi_rol() then raise exception 'No puede cambiar su propio rol'; end if;
  update usuarios set nombre = btrim(actualizar_usuario.nombre), rol = actualizar_usuario.rol::rol_usuario,
    frente = nullif(btrim(actualizar_usuario.frente), ''), encargo = nullif(btrim(actualizar_usuario.encargo), '')
  where id = uid;
  if not found then raise exception 'Usuario no encontrado'; end if;
end; $$;

-- ---------- 3. MÁQUINAS ----------
-- linea: para mostrar en la OT solo los códigos de falla de esa línea (vacía = solo los generales)
create table if not exists public.maquinas (
  nombre text primary key check (btrim(nombre) <> '' and length(nombre) <= 80),
  linea  text
);
insert into public.maquinas (nombre, linea) values
  ('CABALLETE', null), ('CANAL PECHO PALOMA', null), ('CTL BRONX', 'CTL'), ('CTL SESCO', 'CTL'),
  ('CUBIERTA ARQUITECTONICA', 'Cubiertas'), ('CUBIERTA TRAPEZOIDAL', 'Cubiertas'), ('ENTREPISO', 'Entrepiso'),
  ('FORMACERO', null), ('LÍNEA TUBERÍA GG80', null), ('MAQUINAS PEQUENAS', null), ('PERLIN EN C', 'Perlin en C'),
  ('PLATINA', null), ('SLITTER LOOPCO', 'Slitter'), ('SLITTER YODER', 'Slitter'), ('TUBERIA BRITISH', null)
on conflict (nombre) do nothing;
alter table public.maquinas enable row level security;
revoke all on public.maquinas from anon, authenticated;
grant select on public.maquinas to authenticated;   -- se agregan solo con agregar_maquina()
drop policy if exists "leer" on public.maquinas;
create policy "leer" on public.maquinas for select to authenticated using (true);

-- En mayúsculas, como las demás; si ya existe (sin importar mayúsculas), devuelve esa
create or replace function public.agregar_maquina(nombre text, linea text default null)
returns text language plpgsql security definer set search_path = public as $$
declare n text := upper(btrim(nombre)); existe text;
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede agregar máquinas'; end if;
  if coalesce(n, '') = '' or length(n) > 80 then raise exception 'El nombre de la máquina debe tener entre 1 y 80 caracteres'; end if;
  if n = 'OTRO' then raise exception 'OTRO ya es una opción de la lista'; end if;
  if linea is not null and linea not in ('CTL', 'Slitter', 'Cubiertas', 'Perlin en C', 'Entrepiso') then raise exception 'Línea no válida'; end if;
  select m.nombre into existe from maquinas m where upper(m.nombre) = n;
  if existe is not null then return existe; end if;
  insert into maquinas (nombre, linea) values (n, nullif(linea, ''));
  return n;
end; $$;
revoke execute on function public.agregar_maquina(text, text) from public, anon;
grant execute on function public.agregar_maquina(text, text) to authenticated;

notify pgrst, 'reload schema';
