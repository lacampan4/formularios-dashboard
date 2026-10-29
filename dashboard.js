// =====================================================================
//  DASHBOARD: lee v_ordenes y v_fallas (sql/1_esquema.sql) y pinta con Chart.js
// =====================================================================
const ROJO = "#e2231a";
const P_COLOR = { Rojo: "#e2231a", Amarillo: "#ffc600", Verde: "#00a651" };
const P_BORDE = { Rojo: "#e2231a", Amarillo: "#b37f00", Verde: "#00a651" }; // el amarillo necesita borde sobre blanco
const NIVELES = Object.keys(PRIORIDADES);
const diaLocal = (d) => d.toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local
let campoFecha = "creado_en"; // "Cerradas esta semana" filtra por fecha de cierre

Chart.defaults.font.family = "Poppins, Arial, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = "#6b6b6b";
Chart.defaults.plugins.legend.display = false; // todas las gráficas son de una serie: el título la nombra
Chart.defaults.plugins.tooltip.backgroundColor = "#2a2a2a";
Chart.defaults.maintainAspectRatio = false;

const graficas = {};
function grafica(id, tipo, etiquetas, valores, { colores, bordes, horizontal } = {}) {
  graficas[id]?.destroy();
  graficas[id] = new Chart($(id), {
    type: tipo,
    data: { labels: etiquetas, datasets: [{
      data: valores, backgroundColor: colores ?? ROJO, borderColor: bordes ?? colores ?? ROJO,
      borderWidth: tipo === "line" ? 2 : (bordes ? 1 : 0), borderRadius: 4, maxBarThickness: 28,
      pointRadius: 4, pointHoverRadius: 6, tension: 0.25,
    }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: !!horizontal, color: "#e2e2e2" }, border: { display: false }, beginAtZero: true, ticks: { precision: 0 } },
        y: { grid: { display: !horizontal, color: "#e2e2e2" }, border: { display: false }, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
  $(id).setAttribute("aria-label", $(id).closest(".card").querySelector("h2").textContent);
  $(id + "-txt").textContent = etiquetas.length ? etiquetas.map((e, i) => `${e}: ${valores[i]}`).join("; ") : "Sin datos";
}

const contar = (lista, clave) => lista.reduce((m, x) => m.set(clave(x), (m.get(clave(x)) || 0) + 1), new Map());
const mayores = (mapa, n) => [...mapa].sort((a, b) => b[1] - a[1]).slice(0, n);

// ---------------- Filtros ----------------
$("fPrioridad").innerHTML = opciones(NIVELES, "Todas");
const f = $("filtros");
f.hasta.value = diaLocal(new Date());
f.desde.value = diaLocal(new Date(Date.now() - 29 * 864e5));
f.onsubmit = (e) => { e.preventDefault(); campoFecha = "creado_en"; cargar(); };
$("btnSemana").onclick = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes
  f.desde.value = diaLocal(d); f.hasta.value = diaLocal(new Date()); f.estado.value = "Cerrada";
  campoFecha = "cerrada_en"; cargar();
};

async function cargar() {
  if (!f.reportValidity()) return;
  const desde = new Date(f.desde.value + "T00:00").toISOString();
  const hasta = new Date(new Date(f.hasta.value + "T00:00").getTime() + 864e5).toISOString();
  // shortcut: trae todas las filas del rango y agrega en el navegador; con >10.000 órdenes por rango pasar a vistas agregadas en SQL
  let q = db.from("v_ordenes").select("*").gte(campoFecha, desde).lt(campoFecha, hasta).order("creado_en", { ascending: false }).limit(10000);
  let qf = db.from("v_fallas").select("*").gte("creado_en", desde).lt("creado_en", hasta).limit(10000);
  if (f.formato.value) q = q.eq("formato", f.formato.value);
  if (f.prioridad.value) { q = q.eq("prioridad", f.prioridad.value); qf = qf.eq("prioridad", f.prioridad.value); }
  if (f.estado.value) q = q.eq("estado", f.estado.value);
  const [r, rf] = await Promise.all([q, f.formato.value === "OS" ? { data: [] } : qf]);
  if (r.error || rf.error) return aviso("No se pudieron cargar los datos: " + (r.error || rf.error).message, true);
  pintar(r.data, rf.data);
}

function pintar(lista, fallas) {
  const ot = lista.filter((o) => o.formato === "OT"), os = lista.filter((o) => o.formato === "OS");
  const abiertas = lista.filter((o) => o.estado === "Abierta");
  const rojas = lista.filter((o) => o.prioridad === "Rojo").length;
  const pctRojo = lista.length ? Math.round((rojas / lista.length) * 100) : 0;

  // Regla de oro 4: si todo es urgente, nada es urgente (alarma > 30 % en Rojo)
  $("kpis").innerHTML = [
    ["Órdenes en el periodo", lista.length, `${ot.length} OT · ${os.length} OS`],
    ["Abiertas", abiertas.length, `${abiertas.filter((o) => o.formato === "OT").length} OT · ${abiertas.filter((o) => o.formato === "OS").length} OS`],
    ["En Rojo", `${pctRojo} %`, `${rojas} órdenes${pctRojo > 30 ? " · demasiadas urgencias" : ""}`, pctRojo > 30],
  ].map(([t, v, s, alarma]) => `<div class="kpi"><small>${esc(t)}</small><b class="${alarma ? "alarma" : ""}">${esc(v)}</b><small>${esc(s)}</small></div>`).join("");

  const porP = contar(lista, (o) => o.prioridad);
  grafica("gPrioridad", "bar", NIVELES.map((p) => `${p} · ${PRIORIDADES[p]}`), NIVELES.map((p) => porP.get(p) || 0),
    { colores: NIVELES.map((p) => P_COLOR[p]), bordes: NIVELES.map((p) => P_BORDE[p]) });

  // Días del rango con cero incluidos, para que la línea no salte días sin órdenes
  const porDia = contar(lista, (o) => diaLocal(new Date(o[campoFecha])));
  const dias = [];
  for (let d = new Date(f.desde.value + "T00:00"); diaLocal(d) <= f.hasta.value; d.setDate(d.getDate() + 1)) dias.push(diaLocal(d));
  grafica("gDia", "line", dias.map((d) => d.slice(5)), dias.map((d) => porDia.get(d) || 0));

  const codigos = mayores(contar(fallas, (x) => `${String(x.codigo_falla).padStart(2, "0")} ${x.descripcion}`), 10);
  grafica("gCodigos", "bar", codigos.map((c) => c[0]), codigos.map((c) => c[1]), { horizontal: true });

  const maquinas = mayores(contar(ot, (o) => o.detalle), 10);
  grafica("gMaquinas", "bar", maquinas.map((m) => m[0]), maquinas.map((m) => m[1]), { horizontal: true });

  const areas = mayores(contar(os, (o) => o.detalle), 12);
  grafica("gAreas", "bar", areas.map((a) => a[0]), areas.map((a) => a[1]), { horizontal: true });

  const horas = NIVELES.map((p) => {
    const c = lista.filter((o) => o.prioridad === p && o.cerrada_en);
    return c.length ? Math.round(c.reduce((s, o) => s + (new Date(o.cerrada_en) - new Date(o.creado_en)), 0) / c.length / 36e5 * 10) / 10 : 0;
  });
  grafica("gCierre", "bar", NIVELES.map((p) => `${p} · ${PRIORIDADES[p]}`), horas,
    { colores: NIVELES.map((p) => P_COLOR[p]), bordes: NIVELES.map((p) => P_BORDE[p]) });

  $("tabla").tBodies[0].innerHTML = lista.length ? lista.map((o) => `<tr>
      <td class="mono"><a href="consulta.html#${o.formato}/${o.id}">${esc(o.formato)} ${esc(o.numero)}</a></td>
      <td>${fecha(o.creado_en)}</td>
      <td>${chip(o.prioridad)}</td>
      <td>${esc(o.detalle)}</td>
      <td><span class="chip ${esc(o.estado)}">${esc(o.estado)}</span></td>
    </tr>`).join("") : `<tr><td class="vacio" colspan="5">No hay órdenes con estos filtros</td></tr>`;
  etiquetar($("tabla"));
}

// Solo el rol admin ve el dashboard; las vistas v_ordenes y v_fallas tampoco devuelven nada a otros roles
iniciarSesion((perfil) => {
  if (perfil.rol === "admin") return cargar();
  $("vistaApp").innerHTML = `<div class="card"><h2>Acceso restringido</h2>
    <p class="nota">El dashboard es solo para la Dirección de Operaciones.</p>
    <p><a class="btn btn-red" href="registro.html">Ir al registro</a></p></div>`;
});
