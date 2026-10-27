// =====================================================================
//  Utilidades y sesión compartidas por registro.html y dashboard.html
// =====================================================================
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (f) => f ? new Date(f).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }) : "—";
const chip = (t) => `<span class="chip ${esc(t)}">${esc(t)}${PRIORIDADES[t] ? " · " + PRIORIDADES[t] : ""}</span>`;
// lista: ["a", ...] o [{ v, t }, ...]
const opciones = (lista, primero) => (primero != null ? `<option value="">${esc(primero)}</option>` : "") +
  lista.map((x) => typeof x === "object" ? `<option value="${esc(x.v)}">${esc(x.t)}</option>` : `<option>${esc(x)}</option>`).join("");

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

// Muestra el login o la app; llama a alEntrar() la primera vez que hay sesión.
function iniciarSesion(alEntrar) {
  $("vistaAuth").innerHTML = `
    <form class="card" id="formLogin">
      <h1>Operaciones</h1>
      <p class="nota">Ingrese con el correo que le asignó la Dirección de Operaciones.</p>
      <label class="campo"><span>Correo</span><input type="email" name="email" autocomplete="username" required></label>
      <label class="campo"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn btn-red">Ingresar</button>
      <p class="msg" id="authMsg" role="status"></p>
    </form>`;
  if (SUPABASE_URL.includes("TU-PROYECTO")) msg($("authMsg"), "Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en config.js", "error");

  $("formLogin").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    msg($("authMsg"), "Ingresando...");
    const { error } = await db.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
    msg($("authMsg"), error ? (error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message) : "", error && "error");
  };
  $("btnSalir").onclick = () => db.auth.signOut();

  let iniciado = false;
  db.auth.onAuthStateChange((_evento, sesion) => {
    $("vistaAuth").classList.toggle("hidden", !!sesion);
    $("vistaApp").classList.toggle("hidden", !sesion);
    $("userBox").classList.toggle("hidden", !sesion);
    $("userName").textContent = sesion?.user.email ?? "";
    // setTimeout: no llamar a Supabase dentro del callback de auth (bloquea el cliente)
    if (sesion && !iniciado) { iniciado = true; setTimeout(alEntrar, 0); }
  });
}
