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
}

// Guarda con el botón bloqueado; los errores de la base de datos se muestran tal cual.
async function guardar(form, accion) {
  const m = form.querySelector(".msg");
  if (!form.reportValidity()) return msg(m, "Revise los campos marcados.", "error");
  const btn = form.querySelector(".acciones .btn");
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

// Agregar / quitar filas (deja siempre una)
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-agregar]")) agregarFila(e.target.form.querySelector(".tabla"));
  if (e.target.matches("[data-quitar]")) { const tb = e.target.closest("tbody"); if (tb.rows.length > 1) e.target.closest("tr").remove(); }
});

// ---------------- Catálogos fijos ----------------
$("dl-personas").innerHTML = opciones(PERSONAS);
$("osArea").innerHTML = opciones(FRENTES.map((f) => ({ v: f.area, t: `${f.area} (${f.frente})` })), "Seleccione");
$("tiposPermiso").innerHTML = Object.entries(TIPOS_PERMISO).map(([v, t]) => `<label class="check"><input type="checkbox" name="tipos" value="${v}"> ${esc(t)}</label>`).join("");
const SINO = opciones([{ v: "true", t: "Sí" }, { v: "false", t: "No" }], "—");
$("eppLista").innerHTML = EPP.map((e) => `<label class="campo"><span class="req">${esc(e)}</span><select data-epp="${esc(e)}" data-tipo="bool" required>${SINO}</select></label>`).join("");
$("fila-os").content.querySelector(".sel-medida").innerHTML = opciones(MEDIDAS, "—");
$("fila-trab").content.querySelectorAll(".sel-sino").forEach((s) => s.innerHTML = SINO);

// ---------------- Reglas en pantalla ----------------
// Regla 9 + prioridad: riesgo para personas = Rojo y aviso a SST
$("otRiesgo").onchange = (e) => {
  $("otAvisoSST").classList.toggle("hidden", !e.target.checked);
  if (e.target.checked) $("formOT").querySelector('[name=prioridad][value=Rojo]').checked = true;
};
$("formOT").querySelectorAll("[name=prioridad]").forEach((r) => r.addEventListener("change", () => {
  if (r.value !== "Rojo") { $("otRiesgo").checked = false; $("otAvisoSST").classList.add("hidden"); }
}));
$("otAltoRiesgo").onchange = (e) => $("otAvisoATS").classList.toggle("hidden", !e.target.checked);
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
  if (orden.hora_evento) orden.hora_evento = new Date(orden.hora_evento).toISOString();
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
  return `ATS #${id} guardado`;
}); };

$("formPermiso").onsubmit = (e) => {
  e.preventDefault();
  const primerTipo = e.target.querySelector("[name=tipos]");
  primerTipo.setCustomValidity(e.target.querySelector("[name=tipos]:checked") ? "" : "Marque al menos un tipo de tarea");
  guardar(e.target, async () => {
    const d = datos(e.target);
    d.epp = Object.fromEntries([...e.target.querySelectorAll("[data-epp]")].map((s) => [s.dataset.epp, valor(s)]));
    if (!d.tipos.includes("electrico")) { d.metodo_electrico = null; d.nivel_tension = null; }
    const { id } = ok(await db.from("permisos_trabajo").insert(d).select("id").single());
    return `Permiso #${id} guardado`;
  });
};
$("tiposPermiso").addEventListener("change", () => $("formPermiso").querySelector("[name=tipos]").setCustomValidity(""));

// ---------------- Listas desde Supabase ----------------
async function cargarListas() {
  const [ots, atss] = await Promise.all([
    db.from("ordenes_trabajo").select("id, numero, maquina, estado, alto_riesgo").order("id", { ascending: false }).limit(300),
    db.from("ats").select("id, fecha_apertura, ordenes_trabajo(numero)").order("id", { ascending: false }).limit(300),
  ]);
  if (ots.error || atss.error) return aviso("No se pudieron cargar las órdenes: " + (ots.error || atss.error).message, true);
  const lista = ots.data.map((o) => ({ v: o.id, t: `${o.numero} · ${o.maquina}${o.alto_riesgo ? " · alto riesgo" : ""} (${o.estado})` }));
  document.querySelectorAll(".sel-ot").forEach((s) => { const v = s.value; s.innerHTML = opciones(lista, "Seleccione"); s.value = v; });
  $("selATS").innerHTML = opciones(atss.data.map((a) => ({ v: a.id, t: `ATS #${a.id} · ${a.ordenes_trabajo?.numero ?? ""} · ${a.fecha_apertura}` })), "Ninguno");
  $("dl-maquinas").innerHTML = opciones([...new Set(ots.data.map((o) => o.maquina))]);
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

  const { data, error } = await db.from("codigos_falla").select("codigo, descripcion").order("codigo");
  if (error) return aviso("No se pudieron cargar los códigos de falla: " + error.message, true);
  $("fila-ot").content.querySelector(".sel-codigo").innerHTML =
    opciones(data.map((c) => ({ v: c.codigo, t: `${String(c.codigo).padStart(2, "0")} – ${c.descripcion}` })), "Seleccione");
  FORMS.forEach((f) => reiniciar($("form" + f)));
  cargarListas();
}

iniciarSesion(alEntrar);
