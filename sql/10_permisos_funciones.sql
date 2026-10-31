-- =====================================================================
--  PERMISOS DE FUNCIONES (ejecutar después de 9_guia_octubre.sql; se puede volver a ejecutar)
--  Security Advisor de Supabase: las funciones de trigger no deben poder llamarse directo.
--  Los triggers se siguen disparando: Postgres no revisa EXECUTE al dispararlos.
--  No se tocan es_admin(), mi_rol() ni puede(): las reglas RLS las ejecutan con el usuario que consulta.
--  Las RPC de la app (cerrar_ot, cerrar_os, marcar_requisitos_ot, agregar_codigo, usuarios_activos, crear_*)
--  siguen abiertas a usuarios con sesión: cada una valida por dentro quién la llama.
-- =====================================================================
revoke execute on function public.asignar_numero(), public.crear_perfil_usuario(), public.validar_alto_riesgo(),
  public.preparar_ot(), public.preparar_orden() from public, anon, authenticated;
