// =====================================================================
//  BANDEJA: OT y OS en las que el usuario es responsable; él las cierra
//  (cerrar_ot en sql/5_bandeja.sql; cerrar_os en sql/7_os_fotos.sql, que exige al menos una foto)
// =====================================================================
const BUCKET = "fotos-os";
let yo = null;
let nombres = new Map(); // id de usuario -> nombre, para el solicitante
const f = $("filtros");
f.onchange = () => cargar();
f.onsubmit = (e) => e.preventDefault();

const falla = (l) => `<div><b>${esc(String(l.codigo_falla).padStart(2, "0"))} – ${esc(l.codigos_falla?.descripcion)}</b><br>${esc(l.reporte)}</div>`;
const item = (i) => `<div><b>${esc(i.cantidad)} ${esc(i.medida)} · ${esc(i.descripcion)}</b><br>${esc(i.maquina)}</div>`;

// Reduce la foto a 1280 px por lado y JPEG al 70 %: de 4–8 MB pasa a unos 150–300 KB
async function comprimir(archivo) {
  const img = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise((listo) => c.toBlob(listo, "image/jpeg", 0.7));
}

// Fotos de cada OS: carpeta = id de la OS. Enlaces firmados de 1 hora (el bucket es privado).
async function fotosDe(id) {
  const { data } = await db.storage.from(BUCKET).list(String(id));
  if (!data?.length) return [];
  const { data: urls } = await db.storage.from(BUCKET).createSignedUrls(data.map((x) => `${id}/${x.name}`), 3600);
  return (urls ?? []).map((u) => u.signedUrl).filter(Boolean);
}

function accion(o, fotos) {
  const verFotos = fotos.length ? `<div class="fotos">${fotos.map((u, i) =>
    `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto ${i + 1} de la ${esc(o.numero)}"></a>`).join("")}</div>` : "";
  if (o.estado !== "Abierta") return verFotos;
  const cerrar = (attrs = "") => `<button class="btn btn-red" data-cerrar="${o.id}" data-tipo="${o.tipo.toLowerCase()}" data-numero="${esc(o.numero)}" ${attrs}>Cerrar orden</button>`;
  if (o.tipo === "OT") return cerrar();
  return verFotos +
    `<label class="btn btn-sec">${fotos.length ? "Agregar otra foto" : "Tomar o adjuntar foto"}<input type="file" accept="image/*" multiple hidden data-foto="${o.id}"></label>` +
    (fotos.length ? cerrar() : `${cerrar("disabled")}<p class="nota">Adjunte al menos una foto para poder cerrarla.</p>`);
}

async function cargar() {
  const filtro = (q) => (f.estado.value ? q.eq("estado", f.estado.value) : q).eq("responsable", yo).order("creado_en", { ascending: false }).limit(500);
  const [ot, os] = await Promise.all([
    filtro(db.from("ordenes_trabajo").select("id, numero, creado_en, creado_por, prioridad, estado, maquina, ot_lineas(codigo_falla, reporte, codigos_falla(descripcion))")),
    filtro(db.from("ordenes_suministro").select("id, numero, creado_en, creado_por, prioridad, estado, area_solicitante, os_items(maquina, cantidad, medida, descripcion)")),
  ]);
  const error = ot.error || os.error;
  if (error) return aviso("No se pudo cargar la bandeja: " + error.message, true);
  const lista = [...ot.data.map((o) => ({ ...o, tipo: "OT", donde: o.maquina, detalle: o.ot_lineas.map(falla).join("") })),
                 ...os.data.map((o) => ({ ...o, tipo: "OS", donde: o.area_solicitante, detalle: o.os_items.map(item).join("") }))]
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  // shortcut: una consulta de fotos por OS; con cientos de OS en la bandeja, guardar las rutas en una tabla
  const fotos = await Promise.all(lista.map((o) => o.tipo === "OS" ? fotosDe(o.id) : []));

  $("tabla").tBodies[0].innerHTML = lista.length ? lista.map((o, i) => `<tr>
      <td class="mono"><a href="consulta.html?bandeja#${o.tipo}/${o.id}">${esc(o.numero)}</a></td>
      <td>${fecha(o.creado_en)}</td>
      <td>${chip(o.prioridad)}</td>
      <td>${esc(o.donde)}</td>
      <td>${esc(nombres.get(o.creado_por) ?? "—")}</td>
      <td>${o.detalle}</td>
      <td><span class="chip ${esc(o.estado)}">${esc(o.estado)}</span></td>
      <td><a class="btn btn-sec" href="consulta.html?bandeja#${o.tipo}/${o.id}" style="margin-bottom:8px">Abrir</a>${accion(o, fotos[i])}</td>
    </tr>`).join("") : `<tr><td class="vacio" colspan="8">No tiene órdenes ${f.estado.value ? (f.estado.value === "Abierta" ? "abiertas" : "cerradas") : ""}</td></tr>`;
  etiquetar($("tabla"));
  $("conteo").textContent = `${lista.length} orden${lista.length === 1 ? "" : "es"}`;
}

$("tabla").onchange = async (e) => {
  const input = e.target.closest("[data-foto]");
  if (!input?.files.length) return;
  const etiqueta = input.parentElement;
  etiqueta.classList.add("cargando"); etiqueta.firstChild.textContent = "Subiendo…";
  try {
    for (const archivo of input.files) {
      const { error } = await db.storage.from(BUCKET).upload(`${input.dataset.foto}/${crypto.randomUUID()}.jpg`, await comprimir(archivo), { contentType: "image/jpeg" });
      if (error) throw error;
    }
    aviso(input.files.length === 1 ? "Foto adjuntada" : `${input.files.length} fotos adjuntadas`);
  } catch (err) {
    aviso("No se pudo subir la foto: " + err.message, true);
  }
  cargar();
};

$("tabla").onclick = async (e) => {
  const b = e.target.closest("[data-cerrar]");
  if (!b || !confirm(`¿Cerrar la ${b.dataset.numero}? Ya no se podrá reabrir.`)) return;
  b.disabled = true;
  const { error } = await db.rpc("cerrar_" + b.dataset.tipo, { [b.dataset.tipo]: Number(b.dataset.cerrar) });
  if (error) { b.disabled = false; return aviso(error.message, true); }
  aviso(`${b.dataset.numero} cerrada`);
  cargar();
};

iniciarSesion(async () => {
  const [{ data: sesion }, { data: usuarios }] = await Promise.all([db.auth.getSession(), db.rpc("usuarios_activos")]);
  yo = sesion.session.user.id;
  nombres = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  cargar();
});
