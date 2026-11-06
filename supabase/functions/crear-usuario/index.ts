// =====================================================================
//  Edge Function "crear-usuario": el admin crea usuarios desde usuarios.html, sin entrar a Supabase.
//  Crear usuarios exige la llave secreta (service_role): por eso va aquí, en el servidor, y nunca en el navegador.
//  Supabase la pone sola en SUPABASE_SERVICE_ROLE_KEY. Cómo publicarla: README, sección "Crear usuarios desde la app".
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO_USUARIOS = "usuarios.lacampana.co"; // el mismo de config.js
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Quién llama: su sesión viene en el encabezado Authorization; solo un admin sigue
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return responder({ error: "Inicie sesión de nuevo" }, 401);
    const { data: perfil } = await admin.from("usuarios").select("rol").eq("id", user.id).maybeSingle();
    if (perfil?.rol !== "admin") return responder({ error: "Solo un administrador puede crear usuarios" }, 403);

    // Validar lo que llega del navegador
    const { usuario, password, nombre, rol, frente, encargo } = await req.json();
    const u = String(usuario ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(u)) return responder({ error: "Usuario: de 3 a 40 letras, números, punto, guion o guion bajo" }, 400);
    if (String(password ?? "").length < 8) return responder({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
    if (!String(nombre ?? "").trim()) return responder({ error: "Escriba el nombre completo" }, 400);
    // Los roles salen de la base: incluye los que el admin crea en Usuarios (sql/17_cierre_roles_maquinas.sql)
    const { data: roles } = await admin.rpc("roles_disponibles");
    if (!(roles ?? []).some((r: { rol: string }) => r.rol === rol)) return responder({ error: "Rol no válido" }, 400);
    if (String(frente ?? "").length > 60) return responder({ error: "El frente admite hasta 60 caracteres" }, 400);
    if (String(encargo ?? "").length > 120) return responder({ error: "\"Se encarga de\" admite hasta 120 caracteres" }, 400);

    // Crea la cuenta ya confirmada; el trigger crear_perfil_usuario crea su fila en usuarios con el nombre
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: `${u}@${DOMINIO_USUARIOS}`, password, email_confirm: true, user_metadata: { nombre: String(nombre).trim() },
    });
    if (error) {
      const yaExiste = /already|registered|exists/i.test(error.message);
      return responder({ error: yaExiste ? `Ya existe el usuario ${u}` : error.message }, 400);
    }
    const { error: e2 } = await admin.from("usuarios")
      .update({ rol, frente: String(frente ?? "").trim() || null, encargo: String(encargo ?? "").trim() || null }).eq("id", creado.user.id);
    if (e2) return responder({ error: `Se creó ${u}, pero no se pudo guardar su rol: ${e2.message}. Edítelo en la lista.` }, 500);
    return responder({ ok: true, usuario: u });
  } catch (e) {
    return responder({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
