-- =====================================================================
--  MONTACARGAS DE LA PLANTA (ejecutar después de 41_quitar_montacargas.sql; se puede volver a ejecutar)
--  Agrega cada montacargas como máquina propia, con su modelo y su número. No duplica: si ya hay uno con el
--  mismo nombre, aunque esté escrito distinto ("MONTACARGA" en singular, sin el prefijo, otros espacios o
--  minúsculas), no se agrega de nuevo. Después el admin les puede cambiar el nombre con "Editar máquina".
-- =====================================================================
with nuevas(nombre) as (values
  ('MONTACARGAS SNSC 20T #1'), ('MONTACARGAS TOYOTA 10T #2'), ('MONTACARGAS TOYOTA 5T #3'),
  ('MONTACARGAS SNSC S09846S #4'), ('MONTACARGAS SNSC S09845S #5'), ('MONTACARGAS SNSC S09847S #6'),
  ('MONTACARGAS TOYOTA 5T #7'), ('MONTACARGAS YALE 1580 #8'), ('MONTACARGAS YALE 1579 #9'),
  ('MONTACARGAS FRB50M #10'), ('MONTACARGAS CLARK #11'), ('MONTACARGAS NISSAN 60 #12'),
  ('MONTACARGAS NISSAN 110 #13'), ('MONTACARGAS MITSUBISHI'))
-- "MONTACARGAS SNSC 20T #1", "montacarga snsc 20t #1" y "SNSC 20T #1" se comparan como "SNSC20T#1"
, clave as (select nombre, regexp_replace(regexp_replace(upper(nombre), '^\s*MONTACARGAS?\s+', ''), '\s+', '', 'g') k from nuevas)
insert into public.maquinas (nombre, linea)
select c.nombre, null from clave c
where not exists (select 1 from public.maquinas m
                  where regexp_replace(regexp_replace(upper(m.nombre), '^\s*MONTACARGAS?\s+', ''), '\s+', '', 'g') = c.k)
on conflict (nombre) do nothing;

notify pgrst, 'reload schema';
