-- =====================================================================
--  CONSECUTIVOS (ejecutar después de 5_bandeja.sql; se puede volver a ejecutar)
--  Cada formato numera aparte y sin saltos: 00001, 00002, ... El número lo pone la base de datos al guardar.
--  Los formatos ya guardados conservan su número (OT-0004 pasa a 00004) y el consecutivo sigue desde el mayor.
-- =====================================================================

create table if not exists public.consecutivos (
  formato text primary key check (formato in ('OT','OS','ATS','PERMISO')),
  ultimo  integer not null
);
alter table public.consecutivos enable row level security;  -- sin políticas: solo lo toca asignar_numero()
revoke all on public.consecutivos from anon, authenticated;

-- OT y OS: el número era una columna calculada del id; pasa a ser una columna normal
alter table public.ordenes_trabajo    alter column numero drop expression if exists;
alter table public.ordenes_suministro alter column numero drop expression if exists;
alter table public.ats              add column if not exists numero text;
alter table public.permisos_trabajo add column if not exists numero text;

update public.ordenes_trabajo    set numero = lpad(id::text, 5, '0') where numero is null or numero like 'OT-%';
update public.ordenes_suministro set numero = lpad(id::text, 5, '0') where numero is null or numero like 'OS-%';
update public.ats                set numero = lpad(id::text, 5, '0') where numero is null;
update public.permisos_trabajo   set numero = lpad(id::text, 5, '0') where numero is null;

insert into public.consecutivos (formato, ultimo)
select 'OT', coalesce(max(id), 0) from public.ordenes_trabajo union all
select 'OS', coalesce(max(id), 0) from public.ordenes_suministro union all
select 'ATS', coalesce(max(id), 0) from public.ats union all
select 'PERMISO', coalesce(max(id), 0) from public.permisos_trabajo
on conflict (formato) do nothing;

-- El update bloquea la fila del formato hasta terminar el guardado: dos guardados al tiempo no toman el mismo
-- número, y si el guardado falla el contador vuelve atrás con él (sin saltos)
create or replace function public.asignar_numero()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update consecutivos set ultimo = ultimo + 1 where formato = tg_argv[0]
  returning lpad(ultimo::text, 5, '0') into new.numero;
  return new;
end; $$;

do $$
declare t text[];
begin
  foreach t slice 1 in array array[['ordenes_trabajo','OT'], ['ordenes_suministro','OS'], ['ats','ATS'], ['permisos_trabajo','PERMISO']] loop
    -- t0_: corre antes que los demás triggers de la tabla
    execute format('drop trigger if exists t0_numero on public.%I', t[1]);
    execute format('create trigger t0_numero before insert on public.%I for each row execute function public.asignar_numero(%L)', t[1], t[2]);
    execute format('alter table public.%I alter column numero set not null', t[1]);
    execute format('alter table public.%I drop constraint if exists %I', t[1], t[1] || '_numero_unico');
    execute format('alter table public.%I add constraint %I unique (numero)', t[1], t[1] || '_numero_unico');
  end loop;
end $$;
