// =====================================================================
//  CONSULTA: lista de formatos guardados y detalle completo de cada uno (solo admin)
//  Enlaces directos: consulta.html#OT/5, #OS/3, #ATS/2, #PT/4
// =====================================================================
// Las relaciones se nombran (!fk) porque permisos_trabajo une OT y ATS y Supabase las vería ambiguas
const DEF = {
  OT: {
    nombre: "Orden de Trabajo", tabla: "ordenes_trabajo", conEstado: true,
    lista: "id, numero, creado_en, prioridad, estado, maquina",
    fila: (o) => ({ numero: o.numero, prioridad: o.prioridad, detalle: o.maquina, estado: o.estado }),
    detalle: "*, ot_lineas(codigo_falla, reporte, codigos_falla(descripcion)), ordenes_suministro!ordenes_suministro_ot_id_fkey(id, numero), ats!ats_ot_id_fkey(id, numero), permisos_trabajo!permisos_trabajo_ot_id_fkey(id, numero)",
  },
  OS: {
    nombre: "Orden de Suministro", tabla: "ordenes_suministro", conEstado: true,
    lista: "id, numero, creado_en, prioridad, estado, area_solicitante",
    fila: (o) => ({ numero: o.numero, prioridad: o.prioridad, detalle: o.area_solicitante, estado: o.estado }),
    detalle: "*, os_items(*, os_correcciones(*), os_entregas(*)), ordenes_trabajo!ordenes_suministro_ot_id_fkey(id, numero)",
  },
  ATS: {
    nombre: "Análisis de Trabajo Seguro", tabla: "ats", conEstado: true,
    lista: "id, numero, creado_en, estado, descripcion_labor, ordenes_trabajo!ats_ot_id_fkey(numero)",
    fila: (o) => ({ numero: o.numero, detalle: `${o.ordenes_trabajo ? `${o.ordenes_trabajo.numero} · ` : ""}${o.descripcion_labor}`, estado: o.estado }),
    detalle: "*, ats_trabajadores(*), ats_pasos(*), ordenes_trabajo!ats_ot_id_fkey(id, numero), permisos_trabajo!permisos_trabajo_ats_id_fkey(id, numero)",
  },
  PT: {
    nombre: "Permiso de Trabajo Tareas de Alto Riesgo", tabla: "permisos_trabajo",
    lista: "id, numero, creado_en, tarea, ordenes_trabajo!permisos_trabajo_ot_id_fkey(numero)",
    fila: (o) => ({ numero: o.numero, detalle: `${o.ordenes_trabajo ? `${o.ordenes_trabajo.numero} · ` : ""}${o.tarea}` }),
    detalle: "*, ordenes_trabajo!permisos_trabajo_ot_id_fkey(id, numero), ats!permisos_trabajo_ats_id_fkey(id, numero)",
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
     <tbody>${filas.map((f) => `<tr>${f.map((x, j) => `<td data-label="${esc(cols[j])}">${x?.html ?? (vacio(x) ? "—" : esc(x))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
  : `<p class="nota">Sin registros.</p>`;
const cabecera = (tipo, codigo, numero) => `<div class="page-head">
    <span class="ico ico-lg" data-icono="${tipo === "OT" || tipo === "OS" ? "doc" : "escudo"}"></span>
    <div><h2>${esc(DEF[tipo].nombre)}</h2><p>${esc(codigo)}</p></div>
    <div class="no-orden"><b>No.</b><span class="mono">${esc(numero)}</span></div></div>`;
const registro = (o) => [dato("Registrado el", fecha(o.creado_en)), dato("Registrado por", nombres.get(o.creado_por) ?? "—")];
const firmas = (o) => datos(dato("Autorizado por", o.autorizado_por), dato("Entregado por", o.entregado_por), dato("Recibido por", o.recibido_por));

// Desde la bandeja (consulta.html?bandeja#OT/5) el responsable trabaja la OT; desde Consulta el detalle es solo para ver
const desdeBandeja = new URLSearchParams(location.search).has("bandeja");
// Dentro de la ventana flotante de la bandeja: sin barra roja ni botones de Consulta (styles.css)
document.body.classList.toggle("flotante", new URLSearchParams(location.search).has("flotante"));
const trabaja = (o) => desdeBandeja && o.responsable === yo && o.estado !== "Cerrada";  // Abierta o En proceso

// ATS y Permiso de la OT: los marca solo el responsable; el admin los ve; los demás no
let yo = null, esAdmin = false;
let seguimiento = false;  // admin o SST: ven la lista de formatos guardados
let soloSeguridad = false; // SST: la lista muestra solo ATS y permisos de todos (sql/20_sst_consulta.sql)
// Botones para llenar lo que quedó guardado como requerido; abren Registro con la OT ya escogida (fuera de la ventana flotante)
const generar = (id, ats, permiso) =>
  (ats ? `<a class="btn btn-sec btn-ico" target="_top" href="registro.html?ot=${id}&formato=ATS"><span class="ico" data-icono="mas"></span>Generar ATS</a>` : "") +
  (permiso ? `<a class="btn btn-sec btn-ico" target="_top" href="registro.html?ot=${id}&formato=Permiso"><span class="ico" data-icono="mas"></span>Generar permiso de trabajo</a>` : "");
const requisitos = (o) => {
  const titulo = "Análisis del responsable";
  if (trabaja(o)) return bloque(3, "escudo", titulo, `<div class="checks" id="requisitos" data-ot="${o.id}">
      <label class="check"><input type="checkbox" name="ats" ${o.requiere_ats ? "checked" : ""}> Requiere Análisis de Trabajo Seguro (ATS)</label>
      <label class="check"><input type="checkbox" name="permiso" ${o.requiere_permiso ? "checked" : ""}> Requiere Permiso de trabajo de alto riesgo</label>
    </div><p class="nota">Márquelos según su análisis. No son obligatorios para cerrar la orden.</p>
    <div class="acciones-fila">
      <button type="button" class="btn btn-red btn-ico" id="btnGuardarRequisitos" hidden><span class="ico" data-icono="guardar"></span>Guardar</button>
      <span id="generarFormatos">${generar(o.id, o.requiere_ats, o.requiere_permiso)}</span>
    </div>`);
  if (o.responsable === yo || esAdmin) return bloque(3, "escudo", titulo, datos(
    dato("Requiere ATS", siNo(o.requiere_ats)), dato("Requiere permiso de alto riesgo", siNo(o.requiere_permiso))));
  return "";
};

// Firmas por ítem desde la bandeja (sql/12_os_firmas_items.sql): el responsable firma la entrega, el solicitante el recibido
const firmaItem = (por, en) => `${nombres.get(por) ?? "—"} · ${fecha(en)}`;
const botonFirma = (i, como, txt) => ({ html: `<button type="button" class="btn btn-sec btn-firma" data-firmar="${i.id}" data-como="${como}"
  data-texto="${esc(`${i.cantidad} ${i.medida} · ${i.descripcion}`)}">${txt}</button>` });
// Entregas del ítem (sql/25_os_entregas_parciales.sql): "Firmar entrega" entrega todo lo que falta;
// "Entrega parcial" pide cuánto y lo que falta se entrega después. Cada entrega se recibe aparte.
const falta = (i) => Number(i.cantidad) - Number(i.cantidad_entregada ?? 0);
const lineas = (lista) => lista.map((x) => `<div>${esc(x)}</div>`).join("");
const parcial = (i) => `<button type="button" class="btn btn-sec btn-firma" data-abrir-parcial="${i.id}">Entrega parcial</button>
  <div class="cant-entrega" id="parcial-${i.id}" hidden>Entrega <input type="number" data-cant="${i.id}" min="0.01" max="${falta(i)}" step="any" required
    aria-label="Cantidad que entrega"> de ${falta(i)} ${esc(i.medida)} que faltan
    <button type="button" class="btn btn-red btn-firma" data-firmar="${i.id}" data-como="entrega" data-parcial
      data-texto="${esc(`${i.medida} · ${i.descripcion}`)}">Firmar entrega parcial</button></div>`;
const filaEntrega = (o, i) => {
  const puede = desdeBandeja && o.estado !== "Cerrada";
  const entregas = [...(i.os_entregas ?? [])].sort((a, b) => a.id - b.id);
  const porRecibir = entregas.some((x) => !x.recibido_por);
  const quien = (x, por, en) => `${x.cantidad} ${i.medida} · ${firmaItem(por, en)}`;
  // El responsable corrige la cantidad mientras no la hayan recibido (sql/26_os_editar_entrega.sql)
  const editable = (x) => !x.recibido_por && puede && o.responsable === yo;
  const entrego = entregas.map((x) => `<div>${esc(quien(x, x.entregado_por, x.entregado_en))}${x.cantidad_anterior != null ? ` <small class="nota">(corregida; antes ${esc(x.cantidad_anterior)})</small>` : ""}${editable(x)
    ? ` <button type="button" class="btn btn-sec btn-firma" data-editar-entrega="${x.id}">Editar cantidad</button>
      <span class="cant-entrega" id="editar-${x.id}" hidden><input type="number" value="${x.cantidad}" min="0.01" max="${Number(x.cantidad) + falta(i)}" step="any" required aria-label="Cantidad entregada">
      ${esc(i.medida)} <button type="button" class="btn btn-red btn-firma" data-guardar-entrega="${x.id}">Guardar</button></span>` : ""}</div>`).join("");
  const recibio = lineas(entregas.filter((x) => x.recibido_por).map((x) => quien(x, x.recibido_por, x.recibido_en)));
  const entrega = !i.entregado_por && puede && o.responsable === yo, recibe = porRecibir && puede && o.creado_por === yo;
  return [`${i.cantidad} ${i.medida} · ${i.descripcion}`,
    { html: (entrego || (entrega ? "" : "Pendiente")) + (entrega ? `<div class="acciones-fila">${botonFirma({ ...i, cantidad: falta(i) }, "entrega",
      entregas.length ? "Entregar lo que falta" : "Firmar entrega").html}${parcial(i)}</div>` : "") },
    { html: (recibio || (recibe ? "" : "Pendiente")) + (recibe ? botonFirma(i, "recibe", "Firmar recibido").html : "") },
    { html: (i.entregado ? '<span class="chulo">✓ Entregado</span>' : i.entregado_por ? "Entregado, falta el recibido"
      : i.cantidad_entregada ? `<span class="chip proceso">Parcial: ${esc(i.cantidad_entregada)} de ${esc(i.cantidad)} ${esc(i.medida)}</span>` : "Pendiente") + novedad(i) }];
};
// La OS se cierra sola con el último recibido (sql/17_cierre_roles_maquinas.sql). "Cerrar" solo queda para
// OS anteriores a eso que ya tienen todos los ítems firmados.
const cierreOS = (o) => {
  if (o.estado === "Cerrada" || !desdeBandeja || ![o.responsable, o.creado_por].includes(yo)) return "";
  const faltan = o.os_items.filter((i) => !i.entregado).length;
  if (faltan) return `<p class="nota no-imprimir">Faltan ${faltan} ítem${faltan === 1 ? "" : "s"} con las dos firmas (entrega y recibido).
    La orden se cierra sola cuando quien la pidió firme el último recibido. Si no hay todo en el almacén, use <b>Entrega parcial</b>: la orden queda En proceso y lo que falta se entrega después.</p>`;
  return trabaja(o) ? `<div class="acciones no-imprimir" id="cierreOS" data-os="${o.id}" data-numero="${esc(o.numero)}"><span></span>
    <button type="button" class="btn btn-red" id="btnCerrarOS">Cerrar orden</button></div>` : "";
};

// Correcciones de ítems (sql/14_os_correcciones.sql y 22): quien pidió la OS y su responsable, abierta o cerrada
const CAMPOS = { maquina: "Máquina", referencia: "Referencia", marca: "Marca", codigo: "Código", cantidad: "Cantidad", medida: "Medida",
  costo_unitario: "Costo unitario", costo_total: "Costo total", proveedor: "Proveedor", descripcion: "Descripción", funcion: "Función" };
let itemsOS = new Map(); // id -> ítem, para llenar el formulario de corrección
const corrige = (o) => [o.creado_por, o.responsable].includes(yo);
const valorCampo = (k, v) => v == null || v === "" ? "—" : k.startsWith("costo_") ? pesos(v) : String(v);
const cambiosDe = (c) => Object.keys(c.despues).length
  ? { html: Object.keys(c.despues).map((k) => `${esc(CAMPOS[k] ?? k)}: ${esc(valorCampo(k, c.antes[k]))} → <b>${esc(valorCampo(k, c.despues[k]))}</b>`).join("<br>") }
  : "Sin cambios en los datos";
const correcciones = (o) => {
  const lista = o.os_items.flatMap((i) => (i.os_correcciones ?? []).map((c) => ({ ...c, item: i })))
    .sort((a, b) => a.en.localeCompare(b.en));
  return lista.length ? bloque(4, "llave", "Correcciones", tabla(["Fecha", "Corrigió", "Ítem", "Tipo", "Qué estaba mal y cuál fue el cambio", "Cambios"],
    lista.map((c) => [fecha(c.en), nombres.get(c.por) ?? "—", `${c.item.cantidad} ${c.item.medida} · ${c.item.descripcion}`,
      { html: `<span class="chip chip-novedad">${esc(c.tipo)}</span>` }, c.detalle, cambiosDe(c)]))) : "";
};
// Última corrección del ítem, para marcarlo en las entregas
const novedad = (i) => {
  const c = (i.os_correcciones ?? []).reduce((u, x) => !u || x.en > u.en ? x : u, null);
  return c ? ` <span class="chip chip-novedad">${esc(c.tipo)} · corregido</span>` : "";
};

// El responsable llena costo unitario y proveedor en la misma tabla; "Guardar" aparece al escribir.
// Se guarda con corregir_item (sql/22_os_responsable.sql): queda en el historial de correcciones.
const llena = (o) => o.responsable === yo;
const celda = (i, campo, tipo) => ({ html: `<input class="celda-item" type="${tipo}" data-item="${i.id}" name="${campo}" value="${esc(i[campo] ?? "")}"
  ${tipo === "number" ? 'min="0" step="any"' : 'maxlength="120"'} aria-label="${CAMPOS[campo]} de ${esc(i.descripcion)}" placeholder="${tipo === "number" ? "$" : "Proveedor"}">` });
const celdas = () => [...$("detalle").querySelectorAll(".celda-item")];

// Suma de los costos totales de los ítems que tienen costo; "—" si ninguno lo tiene
const totalOS = (items) => {
  const con = items.filter((i) => i.costo_total != null);
  return `<p class="total-os">Total de la orden: <b>${con.length ? pesos(con.reduce((s, i) => s + Number(i.costo_total), 0)) : "—"}</b></p>`;
};

const VISTA = {
  OT: (o) => cabecera("OT", "FO-OPE-001 · Versión 01", o.numero) +
    bloque(1, "info", "Información general", datos(
      dato("Máquina", o.maquina), datoHtml("Prioridad", chip(o.prioridad)), datoHtml("Estado", estado(o.estado)),
      dato("Registrado el", fecha(o.creado_en)), dato("Solicitante", nombres.get(o.creado_por)), dato("Responsable", nombres.get(o.responsable)),
      dato("Cerrada el", o.cerrada_en && fecha(o.cerrada_en)))) +
    bloque(2, "llave", "Código y reporte de falla", tabla(["Código", "Descripción", "Reporte de falla"],
      o.ot_lineas.map((l) => [String(l.codigo_falla).padStart(2, "0"), l.codigos_falla?.descripcion, l.reporte]))) +
    requisitos(o) +
    bloque(4, "lista", "Documentos relacionados", datos(
      datoHtml("Órdenes de suministro", enlaces("OS", o.ordenes_suministro, (x) => x.numero)),
      datoHtml("ATS", enlaces("ATS", o.ats, (x) => x.numero)),
      datoHtml("Permisos de trabajo", enlaces("PT", o.permisos_trabajo, (x) => x.numero)))) +
    // OT anteriores a la bandeja: se siguen viendo sus firmas
    (o.autorizado_por || o.entregado_por || o.recibido_por ? bloque(5, "firma", "Firmas (formato anterior)", firmas(o)) : "") +
    (trabaja(o) ? `<div class="acciones no-imprimir"><span></span><a class="btn btn-red btn-ico" href="registro.html?ot=${o.id}" target="_top">
      <span class="ico" data-icono="mas"></span>Generar orden de suministro</a></div>` : ""),

  OS: (o) => cabecera("OS", "FO-OPE-002 · Versión 01", o.numero) +
    bloque(1, "info", "Información general", datos(
      dato("Área solicitante", o.area_solicitante), datoHtml("Prioridad", chip(o.prioridad)), datoHtml("Estado", estado(o.estado)),
      dato("Registrado el", fecha(o.creado_en)), dato("Solicitante", nombres.get(o.creado_por)), dato("Responsable", nombres.get(o.responsable)),
      datoHtml("OT relacionada", o.ordenes_trabajo ? enlace("OT", o.ordenes_trabajo.id, o.ordenes_trabajo.numero) : "—"),
      dato("Cerrada el", o.cerrada_en && fecha(o.cerrada_en))) +
      // El responsable la marca En proceso cuando empieza a gestionarla (sql/27_os_en_proceso.sql)
      (trabaja(o) && o.estado === "Abierta" ? `<div class="acciones-fila no-imprimir" style="justify-content:flex-end;margin-top:12px">
        <button type="button" class="btn btn-sec" id="btnEnProceso" data-os="${o.id}" data-numero="${esc(o.numero)}">Poner en proceso</button></div>` : "")) +
    bloque(2, "caja", "Ítems solicitados", tabla(["Máquina", "Referencia", "Marca", "Código", "Cantidad", "Medida", "Costo unitario (almacén)", "Costo total (almacén)", "Proveedor (almacén)", "Descripción", "Función",
      ...(corrige(o) ? [""] : [])],
      [...o.os_items].sort((a, b) => a.id - b.id).map((i) => [i.maquina, i.referencia, i.marca, i.codigo, i.cantidad, i.medida,
        llena(o) ? celda(i, "costo_unitario", "number") : pesos(i.costo_unitario),
        llena(o) ? { html: `<span id="ct-${i.id}">${esc(pesos(i.costo_total))}</span>` } : pesos(i.costo_total), llena(o) ? celda(i, "proveedor", "text") : i.proveedor, i.descripcion, i.funcion,
        ...(corrige(o) ? [{ html: `<button type="button" class="btn btn-sec btn-firma no-imprimir" data-corregir="${i.id}" ${o.creado_por === yo ? "" : "data-ajuste"}>${o.creado_por === yo ? "Corregir" : "Editar"}</button>` }] : [])])) +
      totalOS(o.os_items) +
      (llena(o) ? `<div class="acciones-fila no-imprimir" style="justify-content:flex-end"><button type="button" class="btn btn-red btn-ico" id="btnGuardarItems" hidden>
        <span class="ico" data-icono="guardar"></span>Guardar</button></div>` : "")) +
    // Firmas por ítem (sql/12_os_firmas_items.sql): cada quien con su usuario y la hora en que firmó
    bloque(3, "firma", "Entregas por ítem", tabla(["Ítem", "Entregó", "Recibió", "Estado"],
      [...o.os_items].sort((a, b) => a.id - b.id).map((i) => filaEntrega(o, i)))) +
    correcciones(o) +
    // OS anteriores a la bandeja: se siguen viendo sus firmas
    (o.autorizado_por || o.entregado_por || o.recibido_por ? bloque(5, "firma", "Firmas (formato anterior)", firmas(o)) : "") +
    cierreOS(o),

  ATS: (o) => cabecera("ATS", "FR-SST-011 · Versión 1", o.numero) +
    bloque(1, "info", "Información general", datos(
      datoHtml("Orden de trabajo", o.ordenes_trabajo ? enlace("OT", o.ordenes_trabajo.id, o.ordenes_trabajo.numero) : "—"),
      datoHtml("Estado", estado(o.estado)), dato("Realizado el", o.cerrada_en && fecha(o.cerrada_en)),
      dato("Sede", o.sede), dato("Área de ubicación", o.area), dato("Jefe inmediato", o.jefe_inmediato), dato("Responsables", o.responsables),
      dato("Permisos adicionales", [o.alturas && "Alturas", o.caliente && "Caliente", o.energias && "Energías peligrosas"].filter(Boolean).join(", ")),
      ...registro(o), datoHtml("Permisos de trabajo", enlaces("PT", o.permisos_trabajo, (x) => x.numero)))) +
    bloque(2, "personas", "Trabajadores autorizados", tabla(["Nombre", "Cargo", "Óptimo estado de salud", "Medicamentos que causan sueño", "Afiliación SGSS", "Certificado"],
      o.ats_trabajadores.map((t) => [t.nombre, t.cargo, siNo(t.salud_ok), siNo(t.medicamentos_sueno), siNo(t.afiliacion_ss), siNo(t.certificado)]))) +
    bloque(3, "caja", "Descripción de la labor", `<div class="grid grid-2">${texto("Descripción de la labor", o.descripcion_labor)}${texto("Equipos, herramientas y sustancias", o.equipos)}</div>`) +
    bloque(4, "lista", "Paso a paso de la actividad", tabla(["Paso", "Peligros / riesgos", "Consecuencias", "Medidas de control"],
      o.ats_pasos.map((p) => [p.paso, p.peligros, p.consecuencias, p.controles]))) +
    bloque(5, "firma", "Fechas y responsables", datos(
      dato("Fecha de apertura", o.fecha_apertura), dato("Hora de apertura", o.hora_apertura?.slice(0, 5)),
      dato("Vigencia (válido hasta)", o.vigente_hasta && fecha(o.vigente_hasta)), dato("Fecha de cierre", o.fecha_cierre), dato("Trabajador encargado", o.firma_encargado),
      dato("Jefe inmediato", o.firma_jefe), dato("Coordinador de alturas", o.firma_coord_alturas), dato("SST", o.firma_sst))),

  PT: (o) => permiso(o),
};

// Permiso: el FR-SST-039 completo. Las secciones 4 a 10 vienen de detalle_extra (permisos guardados desde sql/19);
// los anteriores no las tienen y se ven como antes.
// Las respuestas se guardan como listas [pregunta, respuesta] en el orden del formato
const respuestas = (lista, vacio = "—") => tabla(["Ítem", "Respuesta"], (lista ?? []).map(([k, v]) => [k, v ?? vacio]));
const pares = (lista) => (lista ?? []).map(([k, v]) => dato(k, v));
const subtitulo = (t) => `<h4 style="margin:16px 0 6px">${esc(t)}</h4>`;
const hay = (lista) => Array.isArray(lista) && lista.length > 0;
function permiso(o) {
  const x = o.detalle_extra ?? {}, c = x.cierre ?? {};
  return VISTA_PT(o) +
    (hay(x.generalidades) ? bloque(4, "lista", "Generalidades de la actividad", respuestas(x.generalidades)) : "") +
    (hay(x.especificas) ? bloque(5, "escudo", "Medidas preventivas específicas",
      x.especificas.map((g) => subtitulo(g.titulo) + respuestas(g.respuestas)).join("")) : "") +
    (hay(x.caliente) ? bloque(6, "llave", "Trabajo en caliente: listas de verificación",
      x.caliente.map((l) => subtitulo(l.titulo) + datos(...pares(l.datos)) + `<div style="margin-top:10px">${respuestas(l.respuestas)}</div>`).join("")) : "") +
    (hay(x.verificacion) ? bloque(7, "check", "Verificación y control diario", datos(...pares(x.verificacion))) : "") +
    bloque(8, "doc", "Documentos anexos", datos(
      dato("Afiliación a seguridad social", siNo(o.afiliacion_ss)), dato("Aptitud médica", siNo(o.aptitud_medica)), ...pares(x.anexos))) +
    bloque(9, "firma", "Firmas de emisión", datos(dato("Ejecutor", o.firma_ejecutor), dato("Emisor", o.firma_emisor), dato("Revisado por SST", o.revisado_sst))) +
    bloque(10, "check", "Cierre del permiso", datos(
      dato("Cierre trabajador", o.cierre_trabajador == null ? "Pendiente" : siNo(o.cierre_trabajador)),
      dato("Cierre jefe de SST", o.cierre_sst == null ? "Pendiente" : siNo(o.cierre_sst)),
      dato("Nombre y C.C. del trabajador", c.cc_trabajador), dato("Nombre y C.C. del emisor", c.cc_emisor)) +
      (hay(c.trabajador) ? subtitulo("Trabajador: personalmente declaro que") + respuestas(c.trabajador, "Pendiente") : "") +
      (hay(c.sst) ? subtitulo("Jefe del área de SST: personalmente he verificado que") + respuestas(c.sst, "Pendiente") : ""));
}
const VISTA_PT = (o) => cabecera("PT", "FR-SST-039 · Versión 1 · Área de Mantenimiento", o.numero) +
    bloque(1, "info", "Datos básicos del permiso", datos(
      datoHtml("Orden de trabajo", o.ordenes_trabajo ? enlace("OT", o.ordenes_trabajo.id, o.ordenes_trabajo.numero) : "—"),
      datoHtml("ATS relacionado", o.ats ? enlace("ATS", o.ats.id, o.ats.numero) : "—"),
      dato("Área / proceso", o.area_proceso), dato("Ubicación", o.ubicacion), dato("Sede", o.sede), dato("Fecha de ejecución", o.fecha_ejecucion),
      dato("Hora de inicio", o.hora_inicio?.slice(0, 5)), dato("Hora de finalización", o.hora_fin?.slice(0, 5)), dato("Vigencia (válido hasta)", o.vigente_hasta ? fecha(o.vigente_hasta) : o.vigencia),
      dato("Trabajador encargado", o.trabajador_encargado), dato("Ayudante de seguridad", o.ayudante_seguridad), ...registro(o))) +
    bloque(2, "llave", "Descripción del trabajo", datos(
      dato("Tarea a realizar", o.tarea), dato("Tipo de tarea", (o.tipos ?? []).map((t) => TIPOS_PERMISO[t] ?? t).join(", ")),
      dato("Método eléctrico", o.metodo_electrico), dato("Nivel de tensión", o.nivel_tension)) +
      `<div class="grid grid-2" style="margin-top:16px">${texto("Descripción de la tarea", o.descripcion)}${texto("Herramientas y equipos", o.herramientas)}</div>`) +
    bloque(3, "escudo", "Elementos de protección personal", datos(...Object.entries(o.epp ?? {}).map(([e, v]) => dato(e, siNo(v)))));

// ---------------- Lista ----------------
const f = $("filtros");
f.hasta.value = new Date().toLocaleDateString("en-CA");
f.desde.value = new Date(Date.now() - 29 * 864e5).toLocaleDateString("en-CA");
f.onsubmit = (e) => { e.preventDefault(); cargarLista(); };

async function cargarLista() {
  if (!f.reportValidity()) return;
  const desde = new Date(f.desde.value + "T00:00").toISOString();
  const hasta = new Date(new Date(f.hasta.value + "T00:00").getTime() + 864e5).toISOString();
  // Estado existe en OT, OS y ATS: si se filtra por estado, el Permiso no aplica
  const tipos = Object.keys(DEF).filter((t) => (!soloSeguridad || t === "ATS" || t === "PT") && (!f.formato.value || f.formato.value === t) && (!f.estado.value || DEF[t].conEstado));
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
  let { data, error } = await db.from(DEF[tipo].tabla).select(DEF[tipo].detalle).eq("id", id).maybeSingle();
  // Sin sql/14_os_correcciones.sql en Supabase (PGRST200: no conoce la relación) la OS se ve igual, sin correcciones
  if (error?.code === "PGRST200" && tipo === "OS")
    ({ data, error } = await db.from(DEF.OS.tabla).select(DEF.OS.detalle.replace("os_items(*, os_correcciones(*), os_entregas(*))", "os_items(*)")).eq("id", id).maybeSingle());
  if (location.hash !== pedido) return; // ya se abrió otro formato mientras cargaba
  if (error) return $("detalle").innerHTML = `<p class="msg error">${esc(error.message)}</p>`;
  if (!data) return $("detalle").innerHTML = `<div class="card"><p>No se encontró ese formato.</p></div>`;
  if (tipo === "OS") itemsOS = new Map(data.os_items.map((i) => [i.id, i]));
  $("detalle").innerHTML = VISTA[tipo](data);
  pintarIconos($("detalle"));
  document.title = `${$("detalle").querySelector(".no-orden .mono").textContent} | La Campana`;
  if (!recargando) window.scrollTo(0, 0);
}
// Formulario de corrección: llega con los datos actuales del ítem; la base guarda solo lo que cambió
const fc = $("formCorregir");
fc.medida.innerHTML = opciones(MEDIDAS);
$("cancelarCorregir").onclick = () => $("dlgCorregir").close();
function abrirCorreccion(id, ajuste) {
  const i = itemsOS.get(id);
  fc.reset(); fc.dataset.item = id;
  // El responsable no escoge tipo: la base lo guarda como "Ajuste del responsable"
  fc.querySelector("fieldset").hidden = ajuste;
  fc.querySelectorAll("[name=tipo]").forEach((r) => r.required = !ajuste);
  $("tituloCorregir").textContent = ajuste ? "Editar ítem" : "Corregir ítem";
  for (const k of Object.keys(CAMPOS)) if (fc[k]) fc[k].value = i[k] ?? "";
  $("dlgCorregir").showModal();
}
fc.onsubmit = async (e) => {
  e.preventDefault();
  const cambios = Object.fromEntries(Object.keys(CAMPOS).filter((k) => fc[k]).map((k) => {
    const v = fc[k].value.trim();
    return [k, v === "" ? null : fc[k].type === "number" ? Number(v) : v];
  }));
  const boton = fc.querySelector("button[type=submit]");
  boton.disabled = true;
  const { error } = await db.rpc("corregir_item", { item: Number(fc.dataset.item), tipo: fc.tipo.value || "Ajuste del responsable", detalle: fc.detalle.value, cambios });
  boton.disabled = false;
  if (error) return aviso(error.message, true);
  $("dlgCorregir").close();
  aviso("Corrección guardada");
  recargar();
};

// Tras firmar o cerrar se vuelve a pintar el detalle sin saltar al inicio
let recargando = false;
const recargar = async () => { recargando = true; try { await mostrar(); } finally { recargando = false; } };
// "Guardar" aparece cuando las casillas difieren de lo guardado (defaultChecked), también al desmarcar las dos
const casillas = () => [...$("requisitos").querySelectorAll("input")];
$("detalle").oninput = (e) => {
  if (e.target.matches(".celda-item")) $("btnGuardarItems").hidden = celdas().every((c) => c.value === c.defaultValue);
  // Mientras escribe el costo unitario: costo total del ítem y total de la orden (la base los vuelve a calcular al guardar)
  if (e.target.matches(".celda-item[name=costo_unitario]")) {
    const total = (i) => {
      const c = $("detalle").querySelector(`.celda-item[data-item="${i.id}"][name=costo_unitario]`);
      return !c ? i.costo_total : c.value === "" ? null : Math.round(Number(i.cantidad) * Number(c.value) * 100) / 100;
    };
    const i = itemsOS.get(Number(e.target.dataset.item));
    $("ct-" + i.id).textContent = pesos(total(i));
    const con = [...itemsOS.values()].map(total).filter((t) => t != null);
    $("detalle").querySelector(".total-os b").textContent = con.length ? pesos(con.reduce((s, t) => s + Number(t), 0)) : "—";
  }
};
$("detalle").onchange = (e) => {
  if (e.target.closest("#requisitos")) $("btnGuardarRequisitos").hidden = casillas().every((c) => c.checked === c.defaultChecked);
};
$("detalle").onclick = async (e) => {
  const co = e.target.closest("[data-corregir]");
  if (co) return abrirCorreccion(Number(co.dataset.corregir), co.hasAttribute("data-ajuste"));
  // Firma del ítem: queda con el usuario de la sesión y la hora del servidor
  const gi = e.target.closest("#btnGuardarItems");
  if (gi) {
    const cambiadas = celdas().filter((c) => c.value !== c.defaultValue);
    if (!cambiadas.every((c) => c.reportValidity())) return;
    const porItem = new Map();
    for (const c of cambiadas) porItem.set(c.dataset.item, { ...porItem.get(c.dataset.item),
      [c.name]: c.value.trim() === "" ? null : c.type === "number" ? Number(c.value) : c.value.trim() });
    gi.disabled = true;
    for (const [item, cambios] of porItem) {
      // La base lo guarda como "Ajuste del responsable"; si el responsable también pidió la OS, queda como "Mal diligenciado"
      const { error } = await db.rpc("corregir_item", { item: Number(item), tipo: "Mal diligenciado", detalle: "Costo o proveedor diligenciado por el responsable", cambios });
      if (error) { gi.disabled = false; return aviso(error.message, true); }
    }
    aviso("Datos guardados");
    return recargar();
  }
  const ee = e.target.closest("[data-editar-entrega]");
  if (ee) {
    const caja = $("editar-" + ee.dataset.editarEntrega);
    ee.hidden = true; caja.hidden = false; return caja.querySelector("input").focus();
  }
  const ge = e.target.closest("[data-guardar-entrega]");
  if (ge) {
    const input = $("editar-" + ge.dataset.guardarEntrega).querySelector("input");
    if (!input.reportValidity()) return;
    ge.disabled = true;
    const { error } = await db.rpc("editar_entrega", { entrega: Number(ge.dataset.guardarEntrega), cantidad: Number(input.value) });
    if (error) { ge.disabled = false; return aviso(error.message, true); }
    aviso("Cantidad de la entrega corregida");
    return recargar();
  }
  const ap = e.target.closest("[data-abrir-parcial]");
  if (ap) {
    const caja = $("parcial-" + ap.dataset.abrirParcial);
    ap.hidden = true; caja.hidden = false; return caja.querySelector("input").focus();
  }
  const fi = e.target.closest("[data-firmar]");
  if (fi) {
    const cant = fi.hasAttribute("data-parcial") ? $("detalle").querySelector(`[data-cant="${fi.dataset.firmar}"]`) : null;
    if (cant && !cant.reportValidity()) return;
    const que = cant ? `la entrega parcial de ${cant.value}` : fi.dataset.como === "entrega" ? "la entrega de" : "que recibió";
    if (!confirm(`¿Firmar ${que}: ${fi.dataset.texto}? Quedará con su nombre y la hora actual.`)) return;
    fi.disabled = true;
    const { error } = await db.rpc("firmar_item", { item: Number(fi.dataset.firmar), como: fi.dataset.como, ...(cant && { cantidad: Number(cant.value) }) });
    if (error) { fi.disabled = false; return aviso(error.message, true); }
    aviso(fi.dataset.como === "entrega" ? "Entrega firmada" : "Recibido firmado");
    return recargar();
  }
  const ep = e.target.closest("#btnEnProceso");
  if (ep) {
    ep.disabled = true;
    const { error } = await db.rpc("poner_en_proceso", { os: Number(ep.dataset.os) });
    if (error) { ep.disabled = false; return aviso(error.message, true); }
    aviso(`${ep.dataset.numero} en proceso`);
    return recargar();
  }
  if (e.target.closest("#btnCerrarOS")) {
    const c = $("cierreOS");
    if (!confirm(`¿Cerrar la ${c.dataset.numero}? Ya no se podrá reabrir.`)) return;
    $("btnCerrarOS").disabled = true;
    const { error } = await db.rpc("cerrar_os", { os: Number(c.dataset.os) });
    if (error) { $("btnCerrarOS").disabled = false; return aviso(error.message, true); }
    aviso(`${c.dataset.numero} cerrada`);
    return recargar();
  }
  const b = e.target.closest("#btnGuardarRequisitos");
  if (!b) return;
  const [ats, permiso] = casillas().map((c) => c.checked);
  const ot = Number($("requisitos").dataset.ot);
  b.disabled = true;
  const { error } = await db.rpc("marcar_requisitos_ot", { ot, ats, permiso });
  b.disabled = false;
  if (error) return aviso(error.message, true);
  // Guardado: lo marcado pasa a ser lo guardado, se oculta hasta el próximo cambio y aparecen los botones para generar lo marcado
  casillas().forEach((c) => c.defaultChecked = c.checked);
  b.hidden = true;
  $("generarFormatos").innerHTML = generar(ot, ats, permiso);
  pintarIconos($("generarFormatos"));
  aviso("Guardado");
};
$("btnImprimir").onclick = () => window.print();
window.addEventListener("hashchange", mostrar);

// La lista es solo para admin. Los demás llegan desde su bandeja a ver el detalle de lo que les asignaron (RLS limita qué ven).
// ---------------- Excel para el dashboard (solo admin): OT y OS de la consulta, cada una en su hoja ----------------
const hora = (f) => f ? new Date(f).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 16) : ""; // AAAA-MM-DD HH:MM, ordena bien en Excel
const horasEntre = (a, b) => a && b ? Math.round((new Date(b) - new Date(a)) / 36e5 * 10) / 10 : "";
function hoja(filas) {
  const h = XLSX.utils.json_to_sheet(filas);
  if (!filas.length) return h;
  const cols = Object.keys(filas[0]);
  h["!cols"] = cols.map((c) => ({ wch: Math.min(50, Math.max(c.length, ...filas.map((f) => String(f[c] ?? "").length)) + 2) }));
  h["!autofilter"] = { ref: h["!ref"] };
  return h;
}
$("btnExcel").onclick = async () => {
  if (!f.reportValidity()) return;
  const b = $("btnExcel");
  b.disabled = true;
  try {
    // La librería se carga solo al descargar
    if (!window.XLSX) await new Promise((ok, mal) => document.head.append(Object.assign(document.createElement("script"),
      { src: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", onload: ok, onerror: () => mal(new Error("No se pudo cargar la librería de Excel")) })));
    const desde = new Date(f.desde.value + "T00:00").toISOString();
    const hasta = new Date(new Date(f.hasta.value + "T00:00").getTime() + 864e5).toISOString();
    // Mismos filtros que la lista; con formato ATS o Permiso se bajan las dos hojas
    const filtrar = (q) => {
      q = q.gte("creado_en", desde).lt("creado_en", hasta).order("creado_en").limit(10000);
      return f.estado.value ? q.eq("estado", f.estado.value) : q;
    };
    const conOT = f.formato.value !== "OS", conOS = f.formato.value !== "OT";
    const buscar = f.buscar.value.trim().toLowerCase();
    const busca = (...t) => !buscar || t.join(" ").toLowerCase().includes(buscar);
    const ninguna = { data: [] };
    const [ot, os] = await Promise.all([
      !conOT ? ninguna : filtrar(db.from("ordenes_trabajo").select("*, ot_lineas(codigo_falla, reporte, codigos_falla(descripcion))")),
      !conOS ? ninguna : filtrar(db.from("ordenes_suministro").select("*, os_items(*), ordenes_trabajo!ordenes_suministro_ot_id_fkey(numero)")),
    ]);
    const error = ot.error || os.error;
    if (error) throw error;
    const n = (id) => nombres.get(id) ?? "";
    ot.data = ot.data.filter((o) => busca(o.numero, o.maquina));
    os.data = os.data.filter((o) => busca(o.numero, o.area_solicitante));

    const filasOT = ot.data.map((o) => ({
      "No.": o.numero, "Creada": hora(o.creado_en), "Solicitante": n(o.creado_por), "Responsable": n(o.responsable),
      "Máquina": o.maquina, "Prioridad": o.prioridad,
      "Códigos de falla": o.ot_lineas.map((l) => `${String(l.codigo_falla).padStart(2, "0")} ${l.codigos_falla?.descripcion ?? ""}`).join("; "),
      "Reporte de falla": o.ot_lineas.map((l) => l.reporte).join("; "),
      "Requiere ATS": siNo(o.requiere_ats), "Requiere permiso": siNo(o.requiere_permiso),
      "Estado": o.estado, "Cerrada": hora(o.cerrada_en), "Horas hasta el cierre": horasEntre(o.creado_en, o.cerrada_en),
    }));
    // Una fila por ítem, con los datos de su OS: así se suman costos y cantidades con filtros de Excel
    const filasOS = os.data.flatMap((o) => (o.os_items.length ? [...o.os_items].sort((a, b) => a.id - b.id) : [{}]).map((i) => ({
      "No.": o.numero, "Creada": hora(o.creado_en), "Solicitante": n(o.creado_por), "Responsable": n(o.responsable),
      "Área solicitante": o.area_solicitante, "Prioridad": o.prioridad, "OT": o.ordenes_trabajo?.numero ?? "",
      "Estado": o.estado, "Cerrada": hora(o.cerrada_en), "Horas hasta el cierre": horasEntre(o.creado_en, o.cerrada_en),
      "Máquina": i.maquina ?? "", "Descripción": i.descripcion ?? "", "Referencia": i.referencia ?? "", "Marca": i.marca ?? "",
      "Código": i.codigo ?? "", "Cantidad": i.cantidad ?? "", "Cantidad entregada": i.cantidad_entregada ?? "", "Medida": i.medida ?? "", "Función": i.funcion ?? "", "Proveedor (almacén)": i.proveedor ?? "",
      "Costo unitario (almacén)": i.costo_unitario ?? "", "Costo total (almacén)": i.costo_total ?? "",
      "Entregó": n(i.entregado_por), "Entregado el": hora(i.entregado_en), "Recibió": n(i.recibido_por), "Recibido el": hora(i.recibido_en),
    })));

    const libro = XLSX.utils.book_new();
    if (conOT) XLSX.utils.book_append_sheet(libro, hoja(filasOT), "Órdenes de trabajo");
    if (conOS) XLSX.utils.book_append_sheet(libro, hoja(filasOS), "Órdenes de suministro");
    XLSX.writeFile(libro, `Ordenes ${f.desde.value} a ${f.hasta.value}.xlsx`);
    aviso(`Excel descargado: ${filasOT.length} OT y ${os.data.length} OS`);
  } catch (e) {
    aviso("No se pudo generar el Excel: " + e.message, true);
  } finally {
    b.disabled = false;
  }
};

iniciarSesion(async (perfil) => {
  const admin = esAdmin = perfil.rol === "admin";
  soloSeguridad = perfil.rol === "sst";
  seguimiento = admin || soloSeguridad;
  yo = (await db.auth.getSession()).data.session.user.id;
  if (!seguimiento && !location.hash) return location.replace("bandeja.html");
  $("btnExcel").hidden = !admin;
  if (soloSeguridad) {
    f.formato.querySelectorAll('option[value="OT"], option[value="OS"]').forEach((op) => op.remove());
    document.querySelector("#vistaLista .page-head p").textContent = "Todos los ATS y permisos de trabajo de alto riesgo de la planta, para hacer seguimiento.";
  }
  if (!seguimiento || desdeBandeja) {
    const volver = document.querySelector('#vistaDetalle a[href="#"]');
    volver.href = "bandeja.html"; volver.lastChild.textContent = "Volver a la bandeja";
  }
  const { data } = admin ? await db.from("usuarios").select("id, nombre, frente, encargo") : await db.rpc("usuarios_activos");
  nombres = new Map((data ?? []).map((u) => [u.id, quien(u)]));
  if (seguimiento) cargarLista();
  mostrar();
});
