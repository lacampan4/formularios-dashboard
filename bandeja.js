// =====================================================================
//  BANDEJA: OT y OS en las que el usuario es responsable y OS que él pidió.
//  La OT se cierra aquí (cerrar_ot, sql/5_bandeja.sql); la OS se firma y se cierra en "Abrir" (consulta.js)
// =====================================================================
let yo = null;
let nombres = new Map(); // id de usuario -> nombre, para el solicitante
const f = $("filtros");
f.onchange = () => cargar();
f.onsubmit = (e) => e.preventDefault();

const falla = (l) => `<div><b>${esc(String(l.codigo_falla).padStart(2, "0"))} – ${esc(l.codigos_falla?.descripcion)}</b><br>${esc(l.reporte)}</div>`;
// Resumen del ítem en la fila; las firmas y el cierre de la OS se hacen en "Abrir" (consulta.js)
const item = (i) => `<div class="item-os${i.entregado ? " listo" : ""}"><b>${i.entregado ? '<span class="chulo" aria-label="Entregado">✓</span> ' : ""}${esc(i.cantidad)} ${esc(i.medida)} · ${esc(i.descripcion)}</b><br>${esc(i.maquina)}
  <div class="firmas-item">${i.entregado ? "Entregado y recibido" : i.entregado_por ? "Entregado, falta firmar el recibido" : "Entrega pendiente"}</div></div>`;
const progreso = (items) => `<p class="nota">${items.filter((i) => i.entregado).length} de ${items.length} ítem${items.length === 1 ? "" : "s"} entregado${items.length === 1 ? "" : "s"}</p>`;
// La OT se sigue cerrando desde la fila
const accion = (o) => o.tipo === "OT" && o.estado === "Abierta" ?
  `<button class="btn btn-red" data-cerrar="${o.id}" data-tipo="ot" data-numero="${esc(o.numero)}">Cerrar orden</button>` : "";

async function cargar() {
  const filtro = (q) => (f.estado.value ? q.eq("estado", f.estado.value) : q).order("creado_en", { ascending: false }).limit(500);
  const [ot, os] = await Promise.all([
    filtro(db.from("ordenes_trabajo").select("id, numero, creado_en, creado_por, prioridad, estado, maquina, ot_lineas(codigo_falla, reporte, codigos_falla(descripcion))").eq("responsable", yo)),
    // OS: las que debe entregar (responsable) y las que pidió (solicitante, para firmar el recibido)
    filtro(db.from("ordenes_suministro").select("id, numero, creado_en, creado_por, responsable, prioridad, estado, area_solicitante, " +
      "os_items(id, maquina, cantidad, medida, descripcion, entregado_por, entregado)")
      .or(`responsable.eq.${yo},creado_por.eq.${yo}`).order("id", { referencedTable: "os_items" })),
  ]);
  const error = ot.error || os.error;
  if (error) return aviso("No se pudo cargar la bandeja: " + error.message, true);
  const lista = [...ot.data.map((o) => ({ ...o, tipo: "OT", donde: o.maquina, detalle: o.ot_lineas.map(falla).join("") })),
                 ...os.data.map((o) => ({ ...o, tipo: "OS", donde: o.area_solicitante, detalle: progreso(o.os_items) + o.os_items.map(item).join("") }))]
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en));

  $("tabla").tBodies[0].innerHTML = lista.length ? lista.map((o) => `<tr>
      <td class="mono"><a href="consulta.html?bandeja#${o.tipo}/${o.id}">${esc(o.numero)}</a></td>
      <td>${fecha(o.creado_en)}</td>
      <td>${chip(o.prioridad)}</td>
      <td>${esc(o.donde)}</td>
      <td>${esc(nombres.get(o.creado_por) ?? "—")}</td>
      <td>${o.detalle}</td>
      <td><span class="chip ${esc(o.estado)}">${esc(o.estado)}</span></td>
      <td><a class="btn btn-sec" href="consulta.html?bandeja#${o.tipo}/${o.id}" style="margin-bottom:8px">Abrir</a>${accion(o)}</td>
    </tr>`).join("") : `<tr><td class="vacio" colspan="8">No tiene órdenes ${f.estado.value ? (f.estado.value === "Abierta" ? "abiertas" : "cerradas") : ""}</td></tr>`;
  etiquetar($("tabla"));
  $("conteo").textContent = `${lista.length} orden${lista.length === 1 ? "" : "es"}`;
}

// "Abrir" muestra el detalle en una ventana flotante, sin salir de la bandeja
$("cerrarDetalle").onclick = () => $("dlgDetalle").close();
$("dlgDetalle").onclose = () => { $("marcoDetalle").src = "about:blank"; cargar(); }; // pudo firmar, cerrar o guardar ATS/Permiso
$("tabla").onclick = async (e) => {
  const a = e.target.closest('a[href^="consulta.html?bandeja"]');
  if (a) {
    e.preventDefault();
    $("marcoDetalle").src = a.getAttribute("href").replace("?bandeja", "?bandeja&flotante");
    return $("dlgDetalle").showModal();
  }
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
