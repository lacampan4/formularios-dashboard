-- =====================================================================
--  OPERACIONES LA CAMPANA - Esquema (ejecutar en Supabase > SQL Editor)
--  FO-OPE-001 OT · FO-OPE-002 OS · FR-SST-011 ATS · FR-SST-039 Permiso
-- =====================================================================

-- ---------- CÓDIGOS DE FALLA (anexo de la guía) ----------
create table if not exists public.codigos_falla (
  codigo      smallint primary key,
  descripcion text not null
);

-- ---------- USUARIOS (se entra con usuario, no con correo) ----------
-- Supabase Auth exige correo: la app usa "<usuario>@usuarios.lacampana.co" (ver DOMINIO_USUARIOS en config.js).
-- Al crear el usuario en Authentication se crea su fila aquí; el nombre completo se edita en Table Editor > usuarios.
create table if not exists public.usuarios (
  id      uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique,
  nombre  text not null
);

create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into usuarios (id, usuario, nombre)
  values (new.id, split_part(new.email, '@', 1),
          coalesce(nullif(btrim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
for each row execute function public.crear_perfil_usuario();

-- ---------- ORDEN DE TRABAJO (FO-OPE-001) ----------
create table if not exists public.ordenes_trabajo (
  id              bigint generated always as identity primary key,
  -- shortcut: una orden rechazada consume su número (OT-0004 → OT-0006); si deben ser sin huecos, usar contador con bloqueo
  numero          text generated always as ('OT-' || lpad(id::text, 4, '0')) stored,
  creado_en       timestamptz not null default now(),          -- regla 3: hora real de emisión
  creado_por      uuid default auth.uid() references auth.users(id),
  hora_evento     timestamptz,                                 -- regla 5: emergencia pedida de palabra
  maquina         text not null check (btrim(maquina) <> ''),  -- regla 2
  prioridad       text not null check (prioridad in ('Rojo','Amarillo','Verde')),
  alto_riesgo     boolean not null default false,              -- regla 6: alturas, caliente o energías
  riesgo_personas boolean not null default false,              -- regla 9: avisar a SST
  autorizado_por  text,
  entregado_por   text,
  recibido_por    text,
  estado          text not null default 'Abierta' check (estado in ('Abierta','Cerrada')),
  cerrada_en      timestamptz,
  check (not riesgo_personas or prioridad = 'Rojo')            -- riesgo para personas = Rojo
);

create table if not exists public.ot_lineas (
  id           bigint generated always as identity primary key,
  ot_id        bigint not null references public.ordenes_trabajo(id) on delete cascade,
  codigo_falla smallint not null references public.codigos_falla(codigo),
  reporte      text not null check (btrim(reporte) <> '')     -- también cubre "83 - Otros: explique"
);

-- ---------- ORDEN DE SUMINISTRO (FO-OPE-002) ----------
create table if not exists public.ordenes_suministro (
  id               bigint generated always as identity primary key,
  numero           text generated always as ('OS-' || lpad(id::text, 4, '0')) stored,
  creado_en        timestamptz not null default now(),
  creado_por       uuid default auth.uid() references auth.users(id),
  area_solicitante text not null check (btrim(area_solicitante) <> ''),
  prioridad        text not null check (prioridad in ('Rojo','Amarillo','Verde')),
  ot_id            bigint references public.ordenes_trabajo(id),  -- "anotar el número de la OT"
  autorizado_por   text,
  entregado_por    text,
  recibido_por     text,
  estado           text not null default 'Abierta' check (estado in ('Abierta','Cerrada')),
  cerrada_en       timestamptz
);

create table if not exists public.os_items (
  id          bigint generated always as identity primary key,
  os_id       bigint not null references public.ordenes_suministro(id) on delete cascade,
  maquina     text not null check (btrim(maquina) <> ''),     -- regla 2: obligatorio por ítem
  referencia  text,
  marca       text,
  codigo      text,
  cantidad    numeric not null check (cantidad > 0),
  medida      text not null check (medida in ('und','kg','m','L')),
  descripcion text not null check (btrim(descripcion) <> ''),
  funcion     text
);

-- ---------- ANÁLISIS DE TRABAJO SEGURO (FR-SST-011) ----------
create table if not exists public.ats (
  id                  bigint generated always as identity primary key,
  ot_id               bigint not null references public.ordenes_trabajo(id),  -- se archiva con la OT
  creado_en           timestamptz not null default now(),
  creado_por          uuid default auth.uid() references auth.users(id),
  sede                text,
  area                text,
  jefe_inmediato      text,
  responsables        text,
  alturas             boolean not null default false,
  caliente            boolean not null default false,
  energias            boolean not null default false,
  descripcion_labor   text not null check (btrim(descripcion_labor) <> ''),
  equipos             text,
  fecha_apertura      date not null default current_date,
  fecha_cierre        date,
  firma_encargado     text not null check (btrim(firma_encargado) <> ''),
  firma_jefe          text not null check (btrim(firma_jefe) <> ''),
  firma_coord_alturas text,
  firma_sst           text,
  check (not alturas or btrim(coalesce(firma_coord_alturas, '')) <> ''),  -- en alturas firma el coordinador
  check (fecha_cierre is null or fecha_cierre >= fecha_apertura)
);

create table if not exists public.ats_trabajadores (
  id                 bigint generated always as identity primary key,
  ats_id             bigint not null references public.ats(id) on delete cascade,
  nombre             text not null check (btrim(nombre) <> ''),
  cargo              text,
  salud_ok           boolean not null,
  medicamentos_sueno boolean not null,
  afiliacion_ss      boolean not null,
  certificado        boolean not null
);

create table if not exists public.ats_pasos (
  id            bigint generated always as identity primary key,
  ats_id        bigint not null references public.ats(id) on delete cascade,
  paso          text not null check (btrim(paso) <> ''),
  peligros      text,
  consecuencias text,
  controles     text not null check (btrim(controles) <> '')
);

-- ---------- PERMISO DE TRABAJO ALTO RIESGO (FR-SST-039) ----------
create table if not exists public.permisos_trabajo (
  id                   bigint generated always as identity primary key,
  ot_id                bigint not null references public.ordenes_trabajo(id),
  ats_id               bigint references public.ats(id),
  creado_en            timestamptz not null default now(),
  creado_por           uuid default auth.uid() references auth.users(id),
  -- 1. Datos básicos
  area_proceso         text not null check (btrim(area_proceso) <> ''),
  ubicacion            text,
  sede                 text,
  fecha_ejecucion      date not null,
  hora_inicio          time,
  hora_fin             time,
  vigencia             text,
  trabajador_encargado text not null check (btrim(trabajador_encargado) <> ''),
  ayudante_seguridad   text,
  -- 2. Descripción
  tarea                text not null check (btrim(tarea) <> ''),
  descripcion          text,
  metodo_electrico     text check (metodo_electrico in ('Energizado','Desenergizado')),
  nivel_tension        text,
  herramientas         text,
  tipos                text[] not null check (tipos <@ array['alturas','caliente','energias','electrico'] and cardinality(tipos) > 0),
  -- 3. EPP {"Arnés de cuerpo entero": true, ...}
  epp                  jsonb not null default '{}',
  -- Anexos y firmas de emisión
  afiliacion_ss        boolean not null default false,
  aptitud_medica       boolean not null default false,
  firma_ejecutor       text not null check (btrim(firma_ejecutor) <> ''),
  firma_emisor         text not null check (btrim(firma_emisor) <> ''),
  revisado_sst         text,
  -- Cierre
  cierre_trabajador    boolean,
  cierre_sst           boolean,
  -- shortcut: páginas 2–8 del FR-SST-039 no vienen en la guía; se guardan aquí hasta tener el formato completo
  detalle_extra        jsonb not null default '{}',
  check (not ('electrico' = any(tipos)) or metodo_electrico is not null)  -- sección 2: marcar energizado/desenergizado
);

-- ---------- TRIGGERS ----------
-- Regla 3 y regla 8: hora del servidor; la orden se cierra solo con las tres firmas.
create or replace function public.preparar_orden()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.creado_en := now(); end if;
  new.autorizado_por := nullif(btrim(new.autorizado_por), '');
  new.entregado_por  := nullif(btrim(new.entregado_por), '');
  new.recibido_por   := nullif(btrim(new.recibido_por), '');
  if new.autorizado_por is not null and new.entregado_por is not null and new.recibido_por is not null then
    new.estado := 'Cerrada';
    new.cerrada_en := coalesce(new.cerrada_en, now());
  else
    new.estado := 'Abierta';
    new.cerrada_en := null;
  end if;
  return new;
end; $$;

-- Regla 6: un trabajo de alto riesgo no se entrega sin ATS y Permiso firmados vinculados a la OT.
create or replace function public.validar_alto_riesgo()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.alto_riesgo and new.entregado_por is not null and (
       not exists (select 1 from ats where ot_id = new.id)
    or not exists (select 1 from permisos_trabajo where ot_id = new.id)) then
    -- new.numero (columna generada) todavía es null en un trigger BEFORE
    raise exception 'La OT-% es de alto riesgo: registre el ATS y el Permiso de Trabajo antes de entregarla', lpad(new.id::text, 4, '0')
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists t1_preparar on public.ordenes_trabajo;
create trigger t1_preparar before insert or update on public.ordenes_trabajo
for each row execute function public.preparar_orden();
drop trigger if exists t2_alto_riesgo on public.ordenes_trabajo;
create trigger t2_alto_riesgo before insert or update on public.ordenes_trabajo
for each row execute function public.validar_alto_riesgo();
drop trigger if exists t1_preparar on public.ordenes_suministro;
create trigger t1_preparar before insert or update on public.ordenes_suministro
for each row execute function public.preparar_orden();

-- ---------- CREAR ORDEN + LÍNEAS EN UNA SOLA TRANSACCIÓN ----------
create or replace function public.crear_ot(orden jsonb, lineas jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_trabajo;
begin
  if coalesce(jsonb_array_length(lineas), 0) = 0 then raise exception 'La OT necesita al menos un código y reporte de falla'; end if;
  insert into ordenes_trabajo (hora_evento, maquina, prioridad, alto_riesgo, riesgo_personas, autorizado_por, entregado_por, recibido_por)
  select r.hora_evento, r.maquina, r.prioridad, coalesce(r.alto_riesgo, false), coalesce(r.riesgo_personas, false),
         r.autorizado_por, r.entregado_por, r.recibido_por
  from jsonb_populate_record(null::ordenes_trabajo, orden) r
  returning * into o;
  insert into ot_lineas (ot_id, codigo_falla, reporte)
  select o.id, l.codigo_falla, l.reporte from jsonb_populate_recordset(null::ot_lineas, lineas) l;
  return o.numero;
end; $$;

create or replace function public.crear_os(orden jsonb, items jsonb)
returns text language plpgsql set search_path = public as $$
declare o ordenes_suministro;
begin
  if coalesce(jsonb_array_length(items), 0) = 0 then raise exception 'La OS necesita al menos un ítem'; end if;
  insert into ordenes_suministro (area_solicitante, prioridad, ot_id, autorizado_por, entregado_por, recibido_por)
  select r.area_solicitante, r.prioridad, r.ot_id, r.autorizado_por, r.entregado_por, r.recibido_por
  from jsonb_populate_record(null::ordenes_suministro, orden) r
  returning * into o;
  insert into os_items (os_id, maquina, referencia, marca, codigo, cantidad, medida, descripcion, funcion)
  select o.id, i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.descripcion, i.funcion
  from jsonb_populate_recordset(null::os_items, items) i;
  return o.numero;
end; $$;

create or replace function public.crear_ats(datos jsonb, trabajadores jsonb, pasos jsonb)
returns bigint language plpgsql set search_path = public as $$
declare a ats;
begin
  if coalesce(jsonb_array_length(trabajadores), 0) = 0 then raise exception 'El ATS necesita al menos un trabajador autorizado'; end if;
  if coalesce(jsonb_array_length(pasos), 0) = 0 then raise exception 'El ATS necesita al menos un paso de la actividad'; end if;
  insert into ats (ot_id, sede, area, jefe_inmediato, responsables, alturas, caliente, energias, descripcion_labor, equipos,
                   fecha_apertura, fecha_cierre, firma_encargado, firma_jefe, firma_coord_alturas, firma_sst)
  select r.ot_id, r.sede, r.area, r.jefe_inmediato, r.responsables, coalesce(r.alturas, false), coalesce(r.caliente, false),
         coalesce(r.energias, false), r.descripcion_labor, r.equipos, coalesce(r.fecha_apertura, current_date), r.fecha_cierre,
         r.firma_encargado, r.firma_jefe, r.firma_coord_alturas, r.firma_sst
  from jsonb_populate_record(null::ats, datos) r
  returning * into a;
  insert into ats_trabajadores (ats_id, nombre, cargo, salud_ok, medicamentos_sueno, afiliacion_ss, certificado)
  select a.id, t.nombre, t.cargo, t.salud_ok, t.medicamentos_sueno, t.afiliacion_ss, t.certificado
  from jsonb_populate_recordset(null::ats_trabajadores, trabajadores) t;
  insert into ats_pasos (ats_id, paso, peligros, consecuencias, controles)
  select a.id, p.paso, p.peligros, p.consecuencias, p.controles
  from jsonb_populate_recordset(null::ats_pasos, pasos) p;
  return a.id;
end; $$;

-- ---------- VISTAS PARA EL DASHBOARD (respetan RLS) ----------
create or replace view public.v_ordenes with (security_invoker = true) as
  select 'OT' as formato, id, numero, creado_en, prioridad, estado, cerrada_en, maquina as detalle,
         autorizado_por, entregado_por, recibido_por, riesgo_personas, alto_riesgo
  from public.ordenes_trabajo
  union all
  select 'OS', id, numero, creado_en, prioridad, estado, cerrada_en, area_solicitante,
         autorizado_por, entregado_por, recibido_por, false, false
  from public.ordenes_suministro;

create or replace view public.v_fallas with (security_invoker = true) as
  select o.creado_en, o.prioridad, o.maquina, l.codigo_falla, c.descripcion
  from public.ot_lineas l
  join public.ordenes_trabajo o on o.id = l.ot_id
  join public.codigos_falla c on c.codigo = l.codigo_falla;

-- ---------- SEGURIDAD: solo usuarios con sesión ----------
alter table public.codigos_falla      enable row level security;
alter table public.usuarios           enable row level security;
alter table public.ordenes_trabajo    enable row level security;
alter table public.ot_lineas          enable row level security;
alter table public.ordenes_suministro enable row level security;
alter table public.os_items           enable row level security;
alter table public.ats                enable row level security;
alter table public.ats_trabajadores   enable row level security;
alter table public.ats_pasos          enable row level security;
alter table public.permisos_trabajo   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['codigos_falla','usuarios','ordenes_trabajo','ot_lineas','ordenes_suministro','os_items',
                           'ats','ats_trabajadores','ats_pasos','permisos_trabajo'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "leer" on public.%I', t);
    execute format('create policy "leer" on public.%I for select to authenticated using (true)', t);
    if t not in ('codigos_falla', 'usuarios') then
      execute format('grant insert on public.%I to authenticated', t);
      execute format('drop policy if exists "crear" on public.%I', t);
      execute format('create policy "crear" on public.%I for insert to authenticated with check (%s)', t,
        case when t in ('ordenes_trabajo','ordenes_suministro','ats','permisos_trabajo') then 'creado_por = auth.uid()' else 'true' end);
    end if;
  end loop;
end $$;

-- Regla 1 (lo escrito no se borra): sin delete. Después de creada, solo se pueden completar las firmas.
grant update (autorizado_por, entregado_por, recibido_por) on public.ordenes_trabajo, public.ordenes_suministro to authenticated;
drop policy if exists "firmar" on public.ordenes_trabajo;
create policy "firmar" on public.ordenes_trabajo for update to authenticated using (true) with check (true);
drop policy if exists "firmar" on public.ordenes_suministro;
create policy "firmar" on public.ordenes_suministro for update to authenticated using (true) with check (true);

revoke all on public.v_ordenes, public.v_fallas from anon;
grant select on public.v_ordenes, public.v_fallas to authenticated;
revoke execute on function public.crear_ot(jsonb, jsonb), public.crear_os(jsonb, jsonb), public.crear_ats(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.crear_ot(jsonb, jsonb), public.crear_os(jsonb, jsonb), public.crear_ats(jsonb, jsonb, jsonb) to authenticated;
