// =====================================================================
//  CONSULTA: lista de formatos guardados y detalle completo de cada uno (solo admin)
//  Enlaces directos: consulta.html#OT/5, #OS/3, #ATS/2, #PT/4
// =====================================================================
const pad = (n) => String(n).padStart(4, "0");
// Las relaciones se nombran (!fk) porque permisos_trabajo une OT y ATS y Supabase las vería ambiguas
const DEF = {
  OT: {
    nombre: "Orden de Trabajo", tabla: "ordenes_trabajo", conEstado: true,
    lista: "id, numero, creado_en, prioridad, estado, maquina",
    fila: (o) => ({ numero: o.numero, prioridad: o.prioridad, detalle: o.maquina, estado: o.estado }),
    detalle: "*, ot_lineas(codigo_falla, reporte, codigos_falla(descripcion)), ordenes_suministro!ordenes_suministro_ot_id_fkey(id, numero), ats!ats_ot_id_fkey(id), permisos_trabajo!permisos_trabajo_ot_id_fkey(id)",
  },
  OS: {
    nombre: "Orden de Suministro", tabla: "ordenes_suministro", conEstado: true,
    lista: "id, numero, creado_en, prioridad, estado, area_solicitante",
    fila: (o) => ({ numero: o.numero, prioridad: o.prioridad, detalle: o.area_solicitante, estado: o.estado }),
    detalle: "*, os_items(*), ordenes_trabajo!ordenes_suministro_ot_id_fkey(id, numero)",
  },
  ATS: {
    nombre: "Análisis de Trabajo Seguro", tabla: "ats",
    lista: "id, creado_en, descripcion_labor, ordenes_trabajo!ats_ot_id_fkey(numero)",
    fila: (o) => ({ numero: "ATS-" + pad(o.id), detalle: `${o.ordenes_trabajo?.numero ?? ""} · ${o.descripcion_labor}` }),
    detalle: "*, ats_trabajadores(*), ats_pasos(*), ordenes_trabajo!ats_ot_id_fkey(id, numero), permisos_trabajo!permisos_trabajo_ats_id_fkey(id)",
  },
  PT: {
    nombre: "Permiso de Trabajo Tareas de Alto Riesgo", tabla: "permisos_trabajo",
    lista: "id, creado_en, tarea, ordenes_trabajo!permisos_trabajo_ot_id_fkey(numero)",
    fila: (o) => ({ numero: "PT-" + pad(o.id), detalle: `${o.ordenes_trabajo?.numero ?? ""} · ${o.tarea}` }),
    detalle: "*, ordenes_trabajo!permisos_trabajo_ot_id_fkey(id, numero), ats!permisos_trabajo_ats_id_fkey(id)",
  },
};
let nombres = new Map(); // id de usuario -> nombre, para "Registrado por"

// ---------------- Piezas del detalle ----------------
const vacio = (v) => v === null || v === undefined || v === "";
const dato = (etq, v) => `<div class="dato"><span>${esc(etq)}</span><b>${vacio(v) ? "—" : esc(v)}</b></div>`;
const datoHtml = (etq, html) => `<div class="dato"><span>${esc(etq)}</span><b>${html}</b></div>`;
const texto = (etq, v) => `<div class="dato dato-largo"><span>${esc(etq)}</span><p>${vacio(v) ? "—" : esc(v)}</p></div>`;
const siNo = (v) => v === null || v === undefined ? "—" : v ? "Sí" : "No";
const enlace = (tipo, id, txt) => `<a href="#${tipo}/${id}">${esc(txt)}</a>`;
const enlaces = (tipo, lista, txt) => lista?.length ? lista.map((x) => enlace(tipo, x.id, txt(x))).join(", ") : "—";
const estado = (e) => `<span class="chip ${esc(e)}">${esc(e)}</span>`;
const bloque = (n, icono, titulo, html) =>
  `<section class="card bloque"><h3 class="seccion"><span class="ico" data-icono="${icono}"></span>${n}. ${esc(titulo)}</h3>${html}</section>`;
const datos = (...html) => `<div class="grid grid-datos">${html.join("")}</div>`;
const tabla = (cols, filas) => filas.length
  ? `<div class="table-wrap"><table class="tabla"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
     <tbody>${filas.map((f) => `<tr>${f.map((x) => `<td>${vacio(x) ? "—" : esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
  : `<p class="nota">Sin registros.</p>`;
const cabecera = (tipo, codigo, numero) => `<div class="page-head">
    <span class="ico ico-lg" data-icono="${tipo === "OT" || tipo === "OS" ? "doc" : "escudo"}"></span>
    <div><h2>${esc(DEF[tipo].nombre)}</h2><p>${esc(codigo)}</p></div>
    <div class="no-orden"><b>No.</b><span class="mono">${esc(numero)}</span></div></div>`;
const registro = (o) => [dato("Registrado el", fecha(o.creado_en)), dato("Registrado por", nombres.get(o.creado_por) ?? "—")];
const firmas = (o) => datos(dato("Autorizado por", o.autorizado_por), dato("Entregado por", o.entregado_por), dato("Recibido por", o.recibido_por));

const VISTA = {
  OT: (o) => cabecera("OT", "FO-OPE-001 · Versión 01", o.numero) +
    bloque(1, "info", "Información general", datos(
      dato("Máquina", o.maquina), datoHtml("Prioridad", chip(o.prioridad)), datoHtml("Estado", estado(o.estado)),
      ...registro(o), dato("Hora real del evento", o.hora_evento && fecha(o.hora_evento)),
      dato("Riesgo para personas", siNo(o.riesgo_personas)), dato("Tarea de alto riesgo", siNo(o.alto_riesgo)), dato("Cerrada el", o.cerrada_en && fecha(o.cerrada_en)))) +
    bloque(2, "llave", "Código y reporte de falla", tabla(["Código", "Descripción", "Reporte de falla"],
      o.ot_lineas.map((l) => [String(l.codigo_falla).padStart(2, "0"), l.codigos_falla?.descripcion, l.reporte]))) +
    bloque(3, "firma", "Firmas", firmas(o)) +
    bloque(4, "lista", "Documentos relacionados", datos(
      datoHtml("Órdenes de suministro", enlaces("OS", o.ordenes_suministro, (x) => x.numero)),
      datoHtml("ATS", enlaces("ATS", o.ats, (x) => "ATS-" + pad(x.id))),
      datoHtml("Permisos de trabajo", enlaces("PT", o.permisos_trabajo, (x) => "PT-" + pad(x.id))))),

  OS: (o) => cabecera("OS", "FO-OPE-002 · Versión 01", o.numero) +
    bloque(1, "info", "Información general", datos(
      dato("Área solicitante", o.area_solicitante), datoHtml("Prioridad", chip(o.prioridad)), datoHtml("Estado", estado(o.estado)),
      ...registro(o), datoHtml("OT relacionada", o.ordenes_trabajo ? enlace("OT", o.ordenes_trabajo.id, o.ordenes_trabajo.numero) : "—"),
      dato("Cerrada el", o.cerrada_en && fecha(o.cerrada_en)))) +
    bloque(2, "caja", "Ítems solicitados", tabla(["Máquina", "Referencia", "Marca", "Código", "Cantidad", "Medida", "Descripción", "Función"],
      o.os_items.map((i) => [i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida, i.descripcion, i.funcion]))) +
    bloque(3, "firma", "Firmas", firmas(o)),

  ATS: (o) => cabecera("ATS", "FR-SST-011 · Versión 1", "ATS-" + pad(o.id)) +
    bloque(1, "info", "Información general", datos(
      datoHtml("Orden de trabajo", o.ordenes_trabajo ? enlace("OT", o.ordenes_trabajo.id, o.ordenes_trabajo.numero) : "—"),
      dato("Sede", o.sede), dato("Área de ubicación", o.area), dato("Jefe inmediato", o.jefe_inmediato), dato("Responsables", o.responsables),
      dato("Permisos adicionales", [o.alturas && "Alturas", o.caliente && "Caliente", o.energias && "Energías peligrosas"].filter(Boolean).join(", ")),
      ...registro(o), datoHtml("Permisos de trabajo", enlaces("PT", o.permisos_trabajo, (x) => "PT-" + pad(x.id))))) +
    bloque(2, "personas", "Trabajadores autorizados", tabla(["Nombre", "Cargo", "Óptimo estado de salud", "Medicamentos que causan sueño", "Afiliación SGSS", "Certificado"],
      o.ats_trabajadores.map((t) => [t.nombre, t.cargo, siNo(t.salud_ok), siNo(t.medicamentos_sueno), siNo(t.afiliacion_ss), siNo(t.certificado)]))) +
    bloque(3, "caja", "Descripción de la labor", `<div class="grid grid-2">${texto("Descripción de la labor", o.descripcion_labor)}${texto("Equipos, herramientas y sustancias", o.equipos)}</div>`) +
    bloque(4, "lista", "Paso a paso de la actividad", tabla(["Paso", "Peligros / riesgos", "Consecuencias", "Medidas de control"],
      o.ats_pasos.map((p) => [p.paso, p.peligros, p.consecuencias, p.controles]))) +
    bloque(5, "firma", "Fechas y responsables", datos(
      dato("Fecha de apertura", o.fecha_apertura), dato("Fecha de cierre", o.fecha_cierre), dato("Trabajador encargado", o.firma_encargado),
      dato("Jefe inmediato", o.firma_jefe), dato("Coordinador de alturas", o.firma_coord_alturas), dato("SST", o.firma_sst))),

  PT: (o) => cabecera("PT", "FR-SST-039 · Versión 1 · Área de Mantenimiento", "PT-" + pad(o.id)) +
    bloque(1, "info", "Datos básicos del permiso", datos(
      datoHtml("Orden de trabajo", o.ordenes_trabajo ? enlace("OT", o.ordenes_trabajo.id, o.ordenes_trabajo.numero) : "—"),
      datoHtml("ATS relacionado", o.ats ? enlace("ATS", o.ats.id, "ATS-" + pad(o.ats.id)) : "—"),
      dato("Área / proceso", o.area_proceso), dato("Ubicación", o.ubicacion), dato("Sede", o.sede), dato("Fecha de ejecución", o.fecha_ejecucion),
      dato("Hora de inicio", o.hora_inicio?.slice(0, 5)), dato("Hora de finalización", o.hora_fin?.slice(0, 5)), dato("Vigencia", o.vigencia),
      dato("Trabajador encargado", o.trabajador_encargado), dato("Ayudante de seguridad", o.ayudante_seguridad), ...registro(o))) +
    bloque(2, "llave", "Descripción del trabajo", datos(
      dato("Tarea a realizar", o.tarea), dato("Tipo de tarea", (o.tipos ?? []).map((t) => TIPOS_PERMISO[t] ?? t).join(", ")),
      dato("Método eléctrico", o.metodo_electrico), dato("Nivel de tensión", o.nivel_tension)) +
      `<div class="grid grid-2" style="margin-top:16px">${texto("Descripción de la tarea", o.descripcion)}${texto("Herramientas y equipos", o.herramientas)}</div>`) +
    bloque(3, "escudo", "Elementos de protección personal", datos(...Object.entries(o.epp ?? {}).map(([e, v]) => dato(e, siNo(v))))) +
    bloque(4, "firma", "Anexos y firmas de emisión", datos(
      dato("Afiliación a seguridad social", siNo(o.afiliacion_ss)), dato("Aptitud médica", siNo(o.aptitud_medica)),
      dato("Ejecutor", o.firma_ejecutor), dato("Emisor", o.firma_emisor), dato("Revisado por SST", o.revisado_sst))) +
    bloque(5, "check", "Cierre del permiso", datos(
      dato("Cierre trabajador", o.cierre_trabajador == null ? "Pendiente" : siNo(o.cierre_trabajador)),
      dato("Cierre jefe de SST", o.cierre_sst == null ? "Pendiente" : siNo(o.cierre_sst)))),
};

// ---------------- Lista ----------------
const f = $("filtros");
f.hasta.value = new Date().toLocaleDateString("en-CA");
f.desde.value = new Date(Date.now() - 29 * 864e5).toLocaleDateString("en-CA");
f.onsubmit = (e) => { e.preventDefault(); cargarLista(); };

async function cargarLista() {
  if (!f.reportValidity()) return;
  const desde = new Date(f.desde.value + "T00:00").toISOString();
  const hasta = new Date(new Date(f.hasta.value + "T00:00").getTime() + 864e5).toISOString();
  // Estado solo existe en OT y OS: si se filtra por estado, ATS y Permiso no aplican
  const tipos = Object.keys(DEF).filter((t) => (!f.formato.value || f.formato.value === t) && (!f.estado.value || DEF[t].conEstado));
  const res = await Promise.all(tipos.map((t) => {
    let q = db.from(DEF[t].tabla).select(DEF[t].lista).gte("creado_en", desde).lt("creado_en", hasta).order("creado_en", { ascending: false }).limit(500);
    if (f.estado.value) q = q.eq("estado", f.estado.value);
    return q;
  }));
  const error = res.find((r) => r.error)?.error;
  if (error) return aviso("No se pudo cargar la lista: " + error.message, true);
  const buscar = f.buscar.value.trim().toLowerCase();
  const filas = res.flatMap((r, i) => r.data.map((o) => ({ tipo: tipos[i], id: o.id, creado_en: o.creado_en, ...DEF[tipos[i]].fila(o) })))
    .filter((x) => !buscar || `${x.numero} ${x.detalle}`.toLowerCase().includes(buscar))
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en));

  $("tabla").tBodies[0].innerHTML = filas.length ? filas.map((x) => `<tr>
      <td class="mono"><a href="#${x.tipo}/${x.id}">${esc(x.numero)}</a></td>
      <td>${esc(x.tipo === "PT" ? "Permiso" : x.tipo)}</td>
      <td>${fecha(x.creado_en)}</td>
      <td>${x.prioridad ? chip(x.prioridad) : "—"}</td>
      <td>${esc(x.detalle)}</td>
      <td>${x.estado ? estado(x.estado) : "—"}</td>
      <td><a class="btn btn-sec" href="#${x.tipo}/${x.id}">Ver detalle</a></td>
    </tr>`).join("") : `<tr><td class="vacio" colspan="7">No hay formatos con estos filtros</td></tr>`;
  etiquetar($("tabla"));
  $("conteo").textContent = `${filas.length} formato${filas.length === 1 ? "" : "s"}`;
}

// ---------------- Detalle (según el #tipo/id de la dirección) ----------------
async function mostrar() {
  const [, tipo, id] = location.hash.match(/^#(OT|OS|ATS|PT)\/(\d+)$/) ?? [];
  $("vistaLista").classList.toggle("hidden", !!tipo);
  $("vistaDetalle").classList.toggle("hidden", !tipo);
  if (!tipo) return;
  $("detalle").innerHTML = `<p class="nota">Cargando…</p>`;
  const pedido = location.hash;
  const { data, error } = await db.from(DEF[tipo].tabla).select(DEF[tipo].detalle).eq("id", id).maybeSingle();
  if (location.hash !== pedido) return; // ya se abrió otro formato mientras cargaba
  if (error) return $("detalle").innerHTML = `<p class="msg error">${esc(error.message)}</p>`;
  if (!data) return $("detalle").innerHTML = `<div class="card"><p>No se encontró ese formato.</p></div>`;
  $("detalle").innerHTML = VISTA[tipo](data);
  pintarIconos($("detalle"));
  document.title = `${$("detalle").querySelector(".no-orden .mono").textContent} | La Campana`;
  window.scrollTo(0, 0);
}
$("btnImprimir").onclick = () => window.print();
window.addEventListener("hashchange", mostrar);

iniciarSesion(async (perfil) => {
  if (perfil.rol !== "admin") {
    $("vistaApp").innerHTML = `<div class="card"><h2>Acceso restringido</h2>
      <p class="nota">La consulta de formatos es solo para la Dirección de Operaciones.</p>
      <p><a class="btn btn-red" href="registro.html">Ir al registro</a></p></div>`;
    return;
  }
  const { data } = await db.from("usuarios").select("id, nombre");
  nombres = new Map((data ?? []).map((u) => [u.id, u.nombre]));
  cargarLista();
  mostrar();
});
