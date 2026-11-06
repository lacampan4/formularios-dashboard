// =====================================================================
//  USUARIOS (solo admin): crear cuentas con la Edge Function crear-usuario (supabase/functions)
//  y editar nombre, rol, frente y encargo con actualizar_usuario (sql/16 y 17).
//  Rol, Frente y "Se encarga de" traen "+ Agregar…" para valores nuevos (sql/17_cierre_roles_maquinas.sql).
// =====================================================================
const NUEVO = "__nuevo";
const FRENTES_GUIA = ["Dirección", ...new Set(FRENTES.map((f) => f.frente))];   // guía, sección 1
const ENCARGOS_GUIA = ["Operación General", ...FRENTES.map((f) => f.area)];
let roles = [], frentes = FRENTES_GUIA, encargos = ENCARGOS_GUIA;              // más los que ya usan los usuarios

// Listas desplegables (no datalist: el navegador lo dibuja distinto) con "+ Agregar…" de primero
const conAgregar = (vacio, texto, valores, actual) => opciones([], vacio) + `<option value="${NUEVO}">+ ${texto}</option>` +
  opciones([...valores, ...(actual && !valores.includes(actual) ? [actual] : [])]);
const listaRoles = () => conAgregar("Seleccione", "Agregar rol",
  roles.map((r) => ({ v: r.rol, t: r.formatos.length ? `${r.rol} (${r.formatos.map((f) => f === "PERMISO" ? "Permiso" : f).join(", ")})` : r.rol })));
// Frente y encargo: al escoger "+ Agregar…" aparece al lado el campo para escribir el nuevo
const campoNuevo = (que) => `<input class="campo-nuevo" data-nuevo="${que}" hidden maxlength="${que === "frente" ? 60 : 120}" placeholder="Escriba el ${que === "frente" ? "frente" : "encargo"} nuevo">`;
const valor = (sel) => sel.value === NUEVO ? sel.nextElementSibling.value.trim() : sel.value;
// value= no sirve en <select>: se pone después de pintar, sin perder lo elegido
const repintar = (sel, html, v = sel.value) => { sel.innerHTML = html; sel.value = v; };
const pintarListas = () => {
  document.querySelectorAll("select[name=rol]").forEach((s) => repintar(s, listaRoles()));
  document.querySelectorAll("#formCrear select[name=frente]").forEach((s) => repintar(s, conAgregar("—", "Agregar frente", frentes)));
  document.querySelectorAll("#formCrear select[name=encargo]").forEach((s) => repintar(s, conAgregar("—", "Agregar encargo", encargos)));
};

async function cargar() {
  const [{ data, error }, r] = await Promise.all([
    db.from("usuarios").select("id, usuario, nombre, rol, frente, encargo").order("nombre"), db.rpc("roles_disponibles")]);
  if (error || r.error) return aviso("No se pudo cargar la lista: " + (error || r.error).message, true);
  roles = r.data;
  const usados = (k) => data.map((u) => u[k]).filter(Boolean);
  frentes = [...new Set([...FRENTES_GUIA, ...usados("frente")])];
  encargos = [...new Set([...ENCARGOS_GUIA, ...usados("encargo")])];
  $("tabla").tBodies[0].innerHTML = data.map((u) => `<tr data-id="${u.id}">
      <td class="mono">${esc(u.usuario)}</td>
      <td><input name="nombre" value="${esc(u.nombre)}" aria-label="Nombre de ${esc(u.usuario)}"></td>
      <td><select name="rol" aria-label="Rol de ${esc(u.usuario)}"></select></td>
      <td><select name="frente" aria-label="Frente de ${esc(u.usuario)}">${conAgregar("—", "Agregar frente", frentes)}</select>${campoNuevo("frente")}</td>
      <td><select name="encargo" aria-label="De qué se encarga ${esc(u.usuario)}">${conAgregar("—", "Agregar encargo", encargos)}</select>${campoNuevo("encargo")}</td>
      <td><button type="button" class="btn btn-sec" data-guardar>Guardar</button></td>
    </tr>`).join("");
  pintarListas();
  data.forEach((u, i) => {
    const tr = $("tabla").tBodies[0].rows[i];
    tr.querySelector("[name=rol]").value = u.rol;
    tr.querySelector("[name=frente]").value = u.frente ?? "";
    tr.querySelector("[name=encargo]").value = u.encargo ?? "";
  });
  etiquetar($("tabla"));
}

// "+ Agregar…": frente y encargo muestran su campo; rol abre la ventana para crearlo con sus formatos
let rolPendiente = null;
document.addEventListener("focusin", (e) => { if (e.target.name === "rol") e.target.dataset.anterior = e.target.value; });
document.addEventListener("change", (e) => {
  const s = e.target;
  if (s.matches("select[name=frente], select[name=encargo]")) {
    const nuevo = s.nextElementSibling;
    nuevo.hidden = s.value !== NUEVO; nuevo.required = s.value === NUEVO;
    if (!nuevo.hidden) nuevo.focus();
  }
  if (s.matches("select[name=rol]") && s.value === NUEVO) {
    rolPendiente = s; s.value = s.dataset.anterior ?? "";
    $("formRol").reset(); msg($("formRol").querySelector(".msg"), "");
    $("dlgRol").showModal();
  }
});
$("cancelarRol").onclick = () => $("dlgRol").close();
$("formRol").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, m = f.querySelector(".msg");
  const formatos = [...f.querySelectorAll("[name=formato]:checked")].map((c) => c.value);
  if (!f.reportValidity()) return;
  if (!formatos.length) return msg(m, "Marque al menos un formato.", "error");
  const { data: rol, error } = await db.rpc("crear_rol", { nombre: f.nombre.value, formatos });
  if (error) return msg(m, error.message, "error");
  roles = (await db.rpc("roles_disponibles")).data ?? roles;
  pintarListas();
  if (rolPendiente) rolPendiente.value = rol;
  $("dlgRol").close();
  aviso(`Rol ${rol} creado`);
};

$("tabla").onclick = async (e) => {
  const b = e.target.closest("[data-guardar]");
  if (!b) return;
  const tr = b.closest("tr"), sel = (n) => tr.querySelector(`[name=${n}]`);
  if ([...tr.querySelectorAll(".campo-nuevo:not([hidden])")].some((i) => !i.reportValidity())) return;
  b.disabled = true;
  const { error } = await db.rpc("actualizar_usuario", { uid: tr.dataset.id, nombre: sel("nombre").value, rol: sel("rol").value,
    frente: valor(sel("frente")), encargo: valor(sel("encargo")) });
  b.disabled = false;
  if (error) return aviso(error.message, true);
  aviso("Guardado");
  if (sel("frente").value === NUEVO || sel("encargo").value === NUEVO) cargar();   // el valor nuevo pasa a las listas
};

$("formCrear").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, m = f.querySelector(".msg");
  if (!f.reportValidity()) return msg(m, "Revise los campos marcados.", "error");
  $("btnCrear").disabled = true; msg(m, "Creando...");
  const body = { usuario: f.usuario.value, password: f.password.value, nombre: f.nombre.value, rol: f.rol.value,
    frente: valor(f.frente), encargo: valor(f.encargo) };
  const { data, error } = await db.functions.invoke("crear-usuario", { body });
  $("btnCrear").disabled = false;
  // El mensaje de la función viene en el cuerpo de la respuesta de error
  const falla = error && ((await error.context?.json?.().catch(() => null))?.error ?? error.message);
  if (falla) return msg(m, falla, "error");
  msg(m, ""); f.reset(); f.querySelectorAll(".campo-nuevo").forEach((i) => { i.hidden = true; i.required = false; });
  aviso(`Usuario ${data.usuario} creado`); cargar();
};

iniciarSesion((perfil) => {
  if (perfil.rol === "admin") return cargar();
  $("vistaApp").innerHTML = `<div class="card"><h2>Acceso restringido</h2>
    <p class="nota">Solo la Dirección de Operaciones administra los usuarios.</p>
    <p><a class="btn btn-red" href="registro.html">Ir al registro</a></p></div>`;
});
