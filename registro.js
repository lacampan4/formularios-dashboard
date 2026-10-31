// =====================================================================
//  REGISTRO: OT (FO-OPE-001), OS (FO-OPE-002), ATS (FR-SST-011), Permiso (FR-SST-039)
// =====================================================================
const FORMS = ["OT", "OS", "ATS", "Permiso"];
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); // AAAA-MM-DD

// ---------------- Lectura de campos ----------------
const valor = (el) => {
  const v = el.value.trim();
  if (v === "") return null;
  if (el.dataset.tipo === "num") return Number(v);
  if (el.dataset.tipo === "bool") return v === "true";
  return v;
};
// Campos del encabezado (con name, fuera de las tablas). Checkbox con value propio = lista (tipos del permiso).
function datos(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name || el.closest(".tabla")) continue;
    if (el.type === "checkbox") {
      if (el.value === "on") d[el.name] = el.checked;
      else (d[el.name] ??= []).push(...(el.checked ? [el.value] : []));
    } else if (el.type === "radio") { if (el.checked) d[el.name] = el.value; else d[el.name] ??= null; }
    else d[el.name] = valor(el);
  }
  return d;
}
const filas = (tabla) => [...tabla.tBodies[0].rows].map((tr) =>
  Object.fromEntries([...tr.querySelectorAll("[data-k]")].map((el) => [el.dataset.k, valor(el)])));

function agregarFila(tabla) {
  tabla.tBodies[0].append($("fila-" + tabla.dataset.fila).content.cloneNode(true));
  etiquetar(tabla);
}
function reiniciar(form) {
  form.reset();
  form.querySelectorAll(".tabla").forEach((t) => { t.tBodies[0].innerHTML = ""; agregarFila(t); });
  form.querySelectorAll(".alerta").forEach((a) => a.classList.add("hidden"));
  if (form.fecha_apertura) form.fecha_apertura.value = hoy();
  $("bloqueElectrico").hidden = true;
  $("otMaquina").onchange();
}

// Guarda con el botón bloqueado; los errores de la base de datos se muestran tal cual.
async function guardar(form, accion) {
  const m = form.querySelector(".msg");
  if (!form.reportValidity()) return msg(m, "Revise los campos marcados.", "error");
  const btn = form.querySelector(".btn-guardar");
  btn.disabled = true; msg(m, "Guardando...");
  try {
    const texto = await accion();
    msg(m, ""); aviso(texto); reiniciar(form); cargarListas();
  } catch (e) {
    msg(m, e.message, "error");
  }
  btn.disabled = false;
}
const ok = ({ data, error }) => { if (error) throw error; return data; };

// ---------------- Pestañas ----------------
FORMS.forEach((f) => $("tab" + f).onclick = () => FORMS.forEach((g) => {
  $("tab" + g).setAttribute("aria-selected", f === g);
  $("form" + g).classList.toggle("hidden", f !== g);
}));

// Agregar / quitar filas (deja siempre una) y limpiar. closest(): el clic puede caer en el ícono del botón.
document.addEventListener("click", (e) => {
  const agregar = e.target.closest("[data-agregar]"), quitar = e.target.closest("[data-quitar]"), limpiar = e.target.closest("[data-limpiar]");
  if (agregar) agregarFila(agregar.closest(".bloque").querySelector(".tabla")); // la tabla de su propia sección
  if (quitar) { const tb = quitar.closest("tbody"); if (tb.rows.length > 1) quitar.closest("tr").remove(); }
  if (limpiar && confirm("¿Borrar todo lo escrito en este formulario?")) { reiniciar(limpiar.form); msg(limpiar.form.querySelector(".msg"), ""); }
});

// ---------------- Catálogos fijos ----------------
$("dl-personas").innerHTML = opciones(PERSONAS);
$("otMaquina").innerHTML = opciones([...MAQUINAS, "OTRO"], "Seleccione");
$("osArea").innerHTML = opciones(FRENTES.map((f) => ({ v: f.area, t: `${f.area} (${f.frente})` })), "Seleccione");
$("tiposPermiso").innerHTML = Object.entries(TIPOS_PERMISO).map(([v, t]) => `<label class="check"><input type="checkbox" name="tipos" value="${v}"> ${esc(t)}</label>`).join("");
const SINO = opciones([{ v: "true", t: "Sí" }, { v: "false", t: "No" }], "—");
$("eppLista").innerHTML = EPP.map((e) => `<label class="campo"><span class="req">${esc(e)}</span><select data-epp="${esc(e)}" data-tipo="bool" required>${SINO}</select></label>`).join("");
$("fila-os").content.querySelector(".sel-medida").innerHTML = opciones(MEDIDAS, "—");
$("fila-trab").content.querySelectorAll(".sel-sino").forEach((s) => s.innerHTML = SINO);

// ---------------- Reglas en pantalla ----------------
// Máquina OTRO: pide escribirla
$("otMaquina").onchange = () => {
  const otro = $("otMaquina").value === "OTRO";
  $("lblMaquinaOtro").hidden = !otro;
  $("otMaquinaOtro").required = otro;
  pintarCodigos();
};
// "+ Nuevo código" (solo admin) abre en esa fila el campo para escribirlo; mientras esté elegido no se puede guardar
$("formOT").addEventListener("change", (e) => {
  const s = e.target.closest(".sel-codigo");
  if (!s) return;
  const nuevo = s.value === "nuevo";
  s.nextElementSibling.hidden = !nuevo;
  s.setCustomValidity(nuevo ? "Agregue el nuevo código o elija uno de la lista" : "");
  if (nuevo) s.nextElementSibling.querySelector("input").focus();
});
$("formOT").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-nuevo-codigo]");
  if (!b) return;
  const input = b.previousElementSibling, s = b.parentElement.previousElementSibling;
  if (!input.value.trim()) return input.focus();
  b.disabled = true;
  const { data: codigo, error } = await db.rpc("agregar_codigo", { descripcion: input.value });
  b.disabled = false;
  if (error) return aviso(error.message, true);
  await cargarCodigos();
  s.value = codigo; input.value = ""; s.dispatchEvent(new Event("change", { bubbles: true }));
  aviso(`Código ${String(codigo).padStart(2, "0")} agregado a la lista`);
});
// En alturas firma el coordinador
$("atsAlturas").onchange = (e) => { $("atsCoord").required = e.target.checked; $("lblCoord").classList.toggle("req", e.target.checked); };
// Riesgo eléctrico: marcar energizado/desenergizado
$("tiposPermiso").onchange = () => {
  const electrico = $("formPermiso").querySelector("[name=tipos][value=electrico]").checked;
  $("bloqueElectrico").hidden = !electrico;
  $("formPermiso").querySelectorAll("[name=metodo_electrico]").forEach((r) => r.required = electrico);
};

// ---------------- Guardar ----------------
$("formOT").onsubmit = (e) => { e.preventDefault(); guardar(e.target, async () => {
  const orden = datos(e.target);
  if (orden.maquina === "OTRO") orden.maquina = orden.maquina_otro;
  const numero = ok(await db.rpc("crear_ot", { orden, lineas: filas(e.target.querySelector(".tabla")) }));
  return `${numero} guardada`;
}); };

$("formOS").onsubmit = (e) => { e.preventDefault(); guardar(e.target, async () => {
  const numero = ok(await db.rpc("crear_os", { orden: datos(e.target), items: filas(e.target.querySelector(".tabla")) }));
  return `${numero} guardada`;
}); };

$("formATS").onsubmit = (e) => { e.preventDefault(); guardar(e.target, async () => {
  const [trab, pasos] = e.target.querySelectorAll(".tabla");
  const id = ok(await db.rpc("crear_ats", { datos: datos(e.target), trabajadores: filas(trab), pasos: filas(pasos) }));
  const { numero } = ok(await db.from("ats").select("numero").eq("id", id).single());
  return `${numero} guardado`;
}); };

$("formPermiso").onsubmit = (e) => {
  e.preventDefault();
  const primerTipo = e.target.querySelector("[name=tipos]");
  primerTipo.setCustomValidity(e.target.querySelector("[name=tipos]:checked") ? "" : "Marque al menos un tipo de tarea");
  guardar(e.target, async () => {
    const d = datos(e.target);
    d.epp = Object.fromEntries([...e.target.querySelectorAll("[data-epp]")].map((s) => [s.dataset.epp, valor(s)]));
    if (!d.tipos.includes("electrico")) { d.metodo_electrico = null; d.nivel_tension = null; }
    const { numero } = ok(await db.from("permisos_trabajo").insert(d).select("numero").single());
    return `${numero} guardado`;
  });
};
$("tiposPermiso").addEventListener("change", () => $("formPermiso").querySelector("[name=tipos]").setCustomValidity(""));

// ---------------- Listas desde Supabase ----------------
async function cargarListas() {
  const [ots, atss] = await Promise.all([
    db.from("ordenes_trabajo").select("id, numero, maquina, estado, alto_riesgo").order("id", { ascending: false }).limit(300),
    db.from("ats").select("id, numero, fecha_apertura, ordenes_trabajo!ats_ot_id_fkey(numero)") /* !fk: permisos_trabajo también une ATS y OT */.order("id", { ascending: false }).limit(300),
  ]);
  if (ots.error || atss.error) return aviso("No se pudieron cargar las órdenes: " + (ots.error || atss.error).message, true);
  const lista = ots.data.map((o) => ({ v: o.id, t: `${o.numero} · ${o.maquina}${o.alto_riesgo ? " · alto riesgo" : ""} (${o.estado})` }));
  document.querySelectorAll(".sel-ot").forEach((s) => { const v = s.value; s.innerHTML = opciones(lista, "Seleccione"); s.value = v; });
  $("selATS").innerHTML = opciones(atss.data.map((a) => ({ v: a.id, t: `${a.numero} · ${a.ordenes_trabajo?.numero ?? ""} · ${a.fecha_apertura}` })), "Ninguno");
  $("dl-maquinas").innerHTML = opciones([...new Set([...MAQUINAS, ...ots.data.map((o) => o.maquina)])]);
}

// En la plantilla de fila y en las filas ya puestas, sin perder lo elegido
let esAdmin = false; // la base de datos también lo exige en agregar_codigo()
let codigos = [];
async function cargarCodigos() {
  const { data, error } = await db.from("codigos_falla").select("codigo, descripcion, lineas").order("codigo");
  if (error) return aviso("No se pudieron cargar los códigos de falla: " + error.message, true);
  codigos = data;
  pintarCodigos();
}
// Con una máquina de la lista: solo los códigos generales y los de su línea (guía, anexo de códigos).
// Sin máquina u OTRO no se sabe la línea: se muestran todos.
function pintarCodigos() {
  const maquina = $("otMaquina").value, linea = LINEA_DE_MAQUINA[maquina];
  const filtrar = maquina && maquina !== "OTRO";
  const html = opciones(codigos.filter((c) => !filtrar || !c.lineas?.length || c.lineas.includes(linea))
    .map((c) => ({ v: c.codigo, t: `${String(c.codigo).padStart(2, "0")} – ${c.descripcion}` })), "Seleccione") +
    (esAdmin ? `<option value="nuevo">+ Nuevo código</option>` : "");
  $("fila-ot").content.querySelector(".sel-codigo").innerHTML = html;
  $("formOT").querySelectorAll(".sel-codigo").forEach((s) => { const v = s.value; s.innerHTML = html; s.value = v; });
}

async function alEntrar(perfil) {
  // Solo las pestañas de los formatos de su rol (sql/3_roles.sql); la base de datos también lo impone
  const { data: rf } = await db.from("rol_formatos").select("formato").eq("rol", perfil.rol);
  const permitidos = perfil.rol === "admin" ? FORMS : FORMS.filter((f) => (rf ?? []).some((r) => r.formato === f.toUpperCase()));
  FORMS.forEach((f) => $("tab" + f).hidden = !permitidos.includes(f));
  if (!permitidos.length) {
    $("vistaApp").innerHTML = `<div class="card"><h2>Sin formularios asignados</h2>
      <p class="nota">Su usuario todavía no tiene un rol. Pida a la Dirección de Operaciones que se lo asigne.</p></div>`;
    return;
  }
  $("tab" + permitidos[0]).click();

  // Solicitante = quien tiene la sesión (la base de datos guarda creado_por); defaultValue sobrevive a form.reset()
  document.querySelectorAll(".solicitante").forEach((i) => i.defaultValue = perfil.nombre);
  esAdmin = perfil.rol === "admin";
  const [{ data: usuarios, error }] = await Promise.all([db.rpc("usuarios_activos"), cargarCodigos()]);
  if (error) aviso("No se pudo cargar la lista de responsables: " + error.message, true);
  const responsables = opciones((usuarios ?? []).map((u) => ({ v: u.id, t: u.nombre })), "Seleccione");
  document.querySelectorAll(".sel-responsable").forEach((s) => s.innerHTML = responsables);
  FORMS.forEach((f) => reiniciar($("form" + f)));
  await cargarListas();
  // registro.html?ot=5[&formato=ATS|Permiso] viene de los botones "Generar…" del detalle de la OT: abre ese formato (OS si no dice) enlazado a esa OT
  const p = new URLSearchParams(location.search), ot = p.get("ot"), f = p.get("formato") ?? "OS";
  if (ot && FORMS.includes(f) && !$("tab" + f).hidden) { $("tab" + f).click(); $("form" + f).ot_id.value = ot; }
}

iniciarSesion(alEntrar);
