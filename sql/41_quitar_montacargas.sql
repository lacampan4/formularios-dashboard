-- =====================================================================
--  SE QUITAN LOS MONTACARGAS NUMERADOS (ejecutar después de 40_os_observaciones.sql; se puede volver a ejecutar)
--  Deshace sql/35_montacargas.sql: salen de la lista "MONTACARGA #1" … "MONTACARGA #13". Los montacargas se
--  agregan uno por uno, como cualquier máquina, con "+ Nueva máquina" (solo admin), y el admin puede cambiarles
--  el nombre con "Editar máquina". Las OT y OS ya guardadas con esos nombres no cambian.
-- =====================================================================
delete from public.maquinas where nombre in (
  'MONTACARGA #1', 'MONTACARGA #2', 'MONTACARGA #3', 'MONTACARGA #4', 'MONTACARGA #5', 'MONTACARGA #6', 'MONTACARGA #7',
  'MONTACARGA #8', 'MONTACARGA #9', 'MONTACARGA #10', 'MONTACARGA #11', 'MONTACARGA #12', 'MONTACARGA #13');

notify pgrst, 'reload schema';
