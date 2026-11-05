// =====================================================================
//  USUARIOS (solo admin): crear cuentas con la Edge Function crear-usuario (supabase/functions)
//  y editar nombre, rol, frente y encargo con actualizar_usuario (sql/16_usuarios_frentes.sql)
// =====================================================================
const ROLES = ["admin", "produccion", "mantenimiento", "abastecimiento", "sst", "sin_rol"];
const LISTA_FRENTES = ["Dirección", ...new Set(FRENTES.map((f) => f.frente))]; // guía, sección 1
document.querySelectorAll(".sel-rol").forEach((s) => s.innerHTML = opciones(ROLES, "Seleccione"));
document.querySelectorAll(".sel-frente").forEach((s) => s.innerHTML = opciones(LISTA_FRENTES, "—"));
// Lista desplegable (no datalist): el navegador dibuja el datalist a su manera y no se ve como los demás campos.
// Para un encargo nuevo, agréguelo en FRENTES de config.js.
const ENCARGOS = ["Operación General", ...FRENTES.map((f) => f.area)];
// Un encargo guardado que no está en la lista se conserva como opción
const opcionesEncargo = (actual) => opciones([...ENCARGOS, ...(actual && !ENCARGOS.includes(actual) ? [actual] : [])], "—");
document.querySelectorAll(".sel-encargo").forEach((s) => s.innerHTML = opcionesEncargo());

async function cargar() {
  const { data, error } = await db.from("usuarios").select("id, usuario, nombre, rol, frente, encargo").order("nombre");
  if (error) return aviso("No se pudo cargar la lista: " + error.message, true);
  $("tabla").tBodies[0].innerHTML = data.map((u) => `<tr data-id="${u.id}">
      <td class="mono">${esc(u.usuario)}</td>
      <td><input name="nombre" value="${esc(u.nombre)}" aria-label="Nombre de ${esc(u.usuario)}"></td>
      <td><select name="rol" aria-label="Rol de ${esc(u.usuario)}">${opciones(ROLES)}</select></td>
      <td><select name="frente" aria-label="Frente de ${esc(u.usuario)}">${opciones(LISTA_FRENTES, "—")}</select></td>
      <td><select name="encargo" aria-label="De qué se encarga ${esc(u.usuario)}">${opcionesEncargo(u.encargo)}</select></td>
      <td><button type="button" class="btn btn-sec" data-guardar>Guardar</button></td>
    </tr>`).join("");
  // value= no sirve en <select>: se ponen después de pintar
  data.forEach((u, i) => { const tr = $("tabla").tBodies[0].rows[i]; tr.querySelector("[name=rol]").value = u.rol; tr.querySelector("[name=frente]").value = u.frente ?? ""; tr.querySelector("[name=encargo]").value = u.encargo ?? ""; });
  etiquetar($("tabla"));
}

$("tabla").onclick = async (e) => {
  const b = e.target.closest("[data-guardar]");
  if (!b) return;
  const tr = b.closest("tr"), v = (n) => tr.querySelector(`[name=${n}]`).value;
  b.disabled = true;
  const { error } = await db.rpc("actualizar_usuario", { uid: tr.dataset.id, nombre: v("nombre"), rol: v("rol"), frente: v("frente"), encargo: v("encargo") });
  b.disabled = false;
  aviso(error ? error.message : "Guardado", !!error);
};

$("formCrear").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, m = f.querySelector(".msg");
  if (!f.reportValidity()) return msg(m, "Revise los campos marcados.", "error");
  $("btnCrear").disabled = true; msg(m, "Creando...");
  const { data, error } = await db.functions.invoke("crear-usuario", { body: Object.fromEntries(new FormData(f)) });
  $("btnCrear").disabled = false;
  // El mensaje de la función viene en el cuerpo de la respuesta de error
  const falla = error && ((await error.context?.json?.().catch(() => null))?.error ?? error.message);
  if (falla) return msg(m, falla, "error");
  msg(m, ""); f.reset(); aviso(`Usuario ${data.usuario} creado`); cargar();
};

iniciarSesion((perfil) => {
  if (perfil.rol === "admin") return cargar();
  $("vistaApp").innerHTML = `<div class="card"><h2>Acceso restringido</h2>
    <p class="nota">Solo la Dirección de Operaciones administra los usuarios.</p>
    <p><a class="btn btn-red" href="registro.html">Ir al registro</a></p></div>`;
});
