-- =====================================================================
--  GUÍA DE OCTUBRE 2026 (ejecutar después de 8_ot_requisitos.sql; se puede volver a ejecutar)
--  1. Códigos de falla 89–117, propios de cada línea (CTL, Slitter, Cubiertas, Perlin en C, Entrepiso).
--  2. Número de cada formato como en la guía: OT-0001, OS-0001, ATS-0001, PT-0001.
-- =====================================================================

-- ---------- 1. CÓDIGOS POR LÍNEA ----------
-- lineas vacío = General (aplica a cualquier máquina). La app muestra en la OT solo los que aplican a la máquina elegida.
alter table public.codigos_falla add column if not exists lineas text[];

drop table if exists pg_temp.guia_codigos;
create temp table guia_codigos (codigo smallint, descripcion text, lineas text[]);
insert into guia_codigos values
  (89,  'Falla en el carro alimentador',          '{CTL,Slitter,Cubiertas,Perlin en C,Entrepiso}'),
  (90,  'Falla en el mandril alimentador',        '{CTL,Slitter,Cubiertas,Perlin en C,Entrepiso}'),
  (91,  'Daño en el clutch del mandril alimentador', '{CTL}'),
  (92,  'Falla en el peeler',                     '{CTL}'),
  (93,  'Falla en el aplanador',                  '{CTL}'),
  (94,  'Falla en la cizalla',                    '{CTL}'),
  (95,  'Falla en la banda transportadora',       '{CTL}'),
  (96,  'Falla en el apilador',                   '{CTL}'),
  (97,  'Falla neumática',                        '{CTL,Slitter}'),
  (98,  'Falla hidráulica',                       '{CTL,Slitter}'),
  (99,  'Falla del montacarga',                   '{CTL,Slitter}'),
  (100, 'Problemas con la lámina',                '{CTL,Slitter,Cubiertas,Perlin en C,Entrepiso}'),
  (101, 'Parada por revisión de calidad',         '{CTL,Slitter,Cubiertas,Perlin en C,Entrepiso}'),
  (102, 'Parada por capacitación',                '{CTL,Slitter,Cubiertas,Perlin en C,Entrepiso}'),
  (103, 'Falla en el mandril embobinador',        '{Slitter}'),
  (104, 'Falla en la volteadora',                 '{Slitter}'),
  (105, 'Falla en la prensa',                     '{Slitter}'),
  (106, 'Falla en el tren de corte',              '{Slitter}'),
  (107, 'Falla de cuchilla',                      '{Cubiertas,Perlin en C,Entrepiso}'),
  (108, 'Falla del paro de emergencia',           '{Cubiertas,Perlin en C,Entrepiso}'),
  (109, 'Falla de programación',                  '{Cubiertas,Perlin en C,Entrepiso}'),
  (110, 'Calibración de máquina',                 '{Cubiertas,Perlin en C,Entrepiso}'),
  (111, 'Fuga de aceite hidráulico',              '{Cubiertas,Perlin en C,Entrepiso}'),
  (112, 'Cambio de cadenas',                      '{Cubiertas,Perlin en C,Entrepiso}'),
  (113, 'Cambio de ejes',                         '{Cubiertas,Perlin en C,Entrepiso}'),
  (114, 'Cambio de montaje',                      '{Perlin en C,Entrepiso}'),
  (115, 'Empalme de cintas',                      '{Perlin en C,Entrepiso}'),
  (116, 'Falla de la marcadora',                  '{Entrepiso}'),
  (117, 'Falta de agua / llenado de tanque',      '{Entrepiso}');

-- Un código creado desde la app con uno de estos números se detiene aquí en vez de sobrescribirlo
do $$
declare choques text;
begin
  select string_agg(c.codigo || ' (' || c.descripcion || ')', ', ') into choques
  from public.codigos_falla c join guia_codigos g using (codigo)
  where lower(c.descripcion) <> lower(g.descripcion);
  if choques is not null then
    raise exception 'Estos códigos ya existen con otra descripción: %. Cambie su número en Table Editor > codigos_falla y vuelva a ejecutar.', choques;
  end if;
end $$;

insert into public.codigos_falla (codigo, descripcion, lineas)
select codigo, descripcion, lineas from guia_codigos
on conflict (codigo) do update set lineas = excluded.lineas;
drop table guia_codigos;

-- ---------- 2. NÚMERO CON PREFIJO ----------
-- greatest(): desde la 10.000 el número sigue creciendo (OT-10000) en vez de cortarse
create or replace function public.asignar_numero()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update consecutivos set ultimo = ultimo + 1 where formato = tg_argv[0] returning ultimo into n;
  new.numero := tg_argv[1] || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
  return new;
end; $$;

do $$
declare t text[];
begin
  foreach t slice 1 in array array[['ordenes_trabajo','OT','OT'], ['ordenes_suministro','OS','OS'], ['ats','ATS','ATS'], ['permisos_trabajo','PERMISO','PT']] loop
    execute format('drop trigger if exists t0_numero on public.%I', t[1]);
    execute format('create trigger t0_numero before insert on public.%I for each row execute function public.asignar_numero(%L, %L)', t[1], t[2], t[3]);
    -- 00012 pasa a OT-0012
    execute format($q$update public.%I set numero = %L || '-' || lpad(numero::int::text, greatest(4, length(numero::int::text)), '0') where numero ~ '^\d+$'$q$, t[1], t[3]);
  end loop;
end $$;
