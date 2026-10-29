// =====================================================================
//  Utilidades y sesión compartidas por registro.html y dashboard.html
// =====================================================================
// La llave secreta (sb_secret_… o service_role) se salta toda la seguridad: nunca debe ir en el navegador ni en GitHub.
const rolLlave = (k) => { try { return JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; } catch { return null; } };
if (SUPABASE_ANON_KEY.startsWith("sb_secret_") || rolLlave(SUPABASE_ANON_KEY) === "service_role") {
  document.body.innerHTML = "<p style='padding:24px;font:16px sans-serif'>config.js tiene la llave SECRETA de Supabase. Bórrela, póngale la llave publishable y genere una llave secreta nueva en Supabase, porque esta ya quedó expuesta.</p>";
  throw new Error("Llave secreta de Supabase en config.js");
}
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (f) => f ? new Date(f).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }) : "—";
const chip = (t) => `<span class="chip ${esc(t)}">${esc(t)}${PRIORIDADES[t] ? " · " + PRIORIDADES[t] : ""}</span>`;
// lista: ["a", ...] o [{ v, t }, ...]
const opciones = (lista, primero) => (primero != null ? `<option value="">${esc(primero)}</option>` : "") +
  lista.map((x) => typeof x === "object" ? `<option value="${esc(x.v)}">${esc(x.t)}</option>` : `<option>${esc(x)}</option>`).join("");

// Íconos de trazo (formas de Lucide, licencia ISC). Uso: <span class="ico" data-icono="doc"></span>
const ICONOS = {
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  llave: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  caja: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  personas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  lista: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  firma: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  basura: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  guardar: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  mas: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  volver: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
};
const pintarIconos = (raiz = document) => raiz.querySelectorAll("[data-icono]").forEach((el) =>
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[el.dataset.icono]}</svg>`);
pintarIconos();

function aviso(texto, error) {
  const t = $("toast");
  t.textContent = texto;
  t.className = "toast" + (error ? " error" : "");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add("hidden"), 5000);
}
function msg(el, texto, tipo) { el.textContent = texto; el.className = "msg " + (tipo || ""); }
// Pone el título de cada columna en sus celdas (se ven como tarjetas en celular)
function etiquetar(tabla) {
  const titulos = [...tabla.querySelectorAll("th")].map((th) => th.textContent);
  tabla.querySelectorAll("tbody tr").forEach((tr) => tr.querySelectorAll("td").forEach((td, i) => td.dataset.label = titulos[i] || ""));
}

const correoDeUsuario = (usuario) => usuario.trim().toLowerCase() + "@" + DOMINIO_USUARIOS;
async function cargarPerfil(id) {
  const { data } = await db.from("usuarios").select("nombre, rol").eq("id", id).maybeSingle();
  return data ?? { nombre: "", rol: "sin_rol" };
}

// Muestra el login o la app; llama a alEntrar(perfil) la primera vez que hay sesión.
function iniciarSesion(alEntrar) {
  $("vistaAuth").innerHTML = `
    <img src="logo-color.webp" alt="La Campana Servicios de Acero" class="logo-login" width="2000" height="552">
    <form class="card" id="formLogin">
      <h1>Operaciones</h1>
      <p class="nota">Ingrese con el usuario que le asignó la Dirección de Operaciones.</p>
      <label class="campo"><span>Usuario</span><input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false"
        pattern="[A-Za-z0-9._\\-]+" title="Solo letras, números, punto, guion y guion bajo" required></label>
      <label class="campo"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn btn-red">Ingresar</button>
      <p class="msg" id="authMsg" role="status"></p>
    </form>`;
  if (SUPABASE_URL.includes("TU-PROYECTO")) msg($("authMsg"), "Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en config.js", "error");

  $("formLogin").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    msg($("authMsg"), "Ingresando...");
    const { error } = await db.auth.signInWithPassword({ email: correoDeUsuario(f.get("usuario")), password: f.get("password") });
    msg($("authMsg"), error ? (error.message === "Invalid login credentials" ? "Usuario o contraseña incorrectos" : error.message) : "", error && "error");
  };
  // scope local: borra la sesión de este dispositivo aunque no haya conexión; luego siempre al login
  $("btnSalir").onclick = async () => {
    $("btnSalir").disabled = true;
    await db.auth.signOut({ scope: "local" }).catch(() => {});
    location.replace("registro.html");
  };

  let iniciado = false;
  db.auth.onAuthStateChange((evento, sesion) => {
    // Sesión cerrada (aquí, en otra pestaña o vencida): al login; el siguiente usuario parte de cero, con su propio rol
    if (evento === "SIGNED_OUT") return location.replace("registro.html");
    $("vistaAuth").classList.toggle("hidden", !!sesion);
    $("vistaApp").classList.toggle("hidden", !sesion);
    $("userBox").classList.toggle("hidden", !sesion);
    $("userName").textContent = sesion?.user.email.split("@")[0] ?? "";
    // setTimeout: no llamar a Supabase dentro del callback de auth (bloquea el cliente)
    if (sesion && !iniciado) {
      iniciado = true;
      setTimeout(async () => {
        const perfil = await cargarPerfil(sesion.user.id);
        if (perfil.nombre) $("userName").textContent = perfil.nombre;
        document.querySelectorAll("[data-solo-admin]").forEach((a) => a.hidden = perfil.rol !== "admin");
        alEntrar(perfil);
      }, 0);
    }
  });
}
