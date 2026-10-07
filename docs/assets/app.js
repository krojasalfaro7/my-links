// Mis links: lista pública + privados y panel de gestión con sesión (Google o clave).
// La config de Firebase es pública por diseño; lo que protege los datos son las reglas (firestore.rules).
// Sin imports estáticos: primero se pinta la caché de links públicos y las librerías se bajan en paralelo.
const OWNER = "krojas.alfaro7@gmail.com";
const CLAVE_EMAIL = "krojas.alfaro7+links@gmail.com";
const COL = { publico: "links_publicos", privado: "links_privados" };
const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";

const $ = id => document.getElementById(id);
const estado = { publicos: [], privados: [], sesion: false, texto: "", cat: "", orden: "manual", vista: "tarjetas" };

// ── preferencias y caché (solo links públicos; los privados nunca se guardan) ──
const guardarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const leerLocal = k => { try { return localStorage.getItem(k); } catch { return null; } };

const root = document.documentElement;
const tema = leerLocal("tema");
if (tema) root.dataset.theme = tema;
$("tema").onclick = () => {
  const oscuro = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = oscuro ? "light" : "dark";
  guardarLocal("tema", root.dataset.theme);
};

estado.orden = ["manual", "az", "recientes"].includes(leerLocal("orden")) ? leerLocal("orden") : "manual";
estado.vista = leerLocal("vista") === "compacta" ? "compacta" : "tarjetas";
$("orden").value = estado.orden;
$("orden").onchange = e => { estado.orden = e.target.value; guardarLocal("orden", estado.orden); pintar(); };
$("vista").onclick = () => {
  estado.vista = estado.vista === "compacta" ? "tarjetas" : "compacta";
  guardarLocal("vista", estado.vista);
  pintar();
};

try { estado.publicos = JSON.parse(leerLocal("cache_publicos") || "[]"); } catch { estado.publicos = []; }

// ── utilidades ────────────────────────────────────────────────────────────
const urlSegura = u => { try { return /^https?:$/.test(new URL(u).protocol) ? u : ""; } catch { return ""; } };
const etiquetas = s => [...new Set(String(s || "").split(",").map(x => x.trim()).filter(Boolean))];
const todos = () => [...estado.publicos, ...estado.privados];
const lista = v => (v === "publico" ? estado.publicos : estado.privados);
const claveOrden = l => l.orden ?? l.creado ?? 0;
const porTitulo = (a, b) => String(a.titulo).localeCompare(String(b.titulo), "es");

function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto;
  return e;
}

function mensaje(t, ms) {
  $("msg").textContent = t;
  if (ms) setTimeout(() => { if ($("msg").textContent === t) $("msg").textContent = ""; }, ms);
}

// ── lista ─────────────────────────────────────────────────────────────────
function coincide(l) {
  if (estado.cat && l.categoria !== estado.cat) return false;
  const q = estado.texto.trim().toLowerCase();
  if (!q) return true;
  return [l.titulo, l.url, l.descripcion, l.categoria, ...(l.etiquetas || [])].join(" ").toLowerCase().includes(q);
}

function ordenar(arr) {
  const fav = (a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0);
  if (estado.orden === "az") return arr.sort((a, b) => fav(a, b) || porTitulo(a, b));
  if (estado.orden === "recientes") return arr.sort((a, b) => fav(a, b) || (b.creado || 0) - (a.creado || 0));
  return arr.sort((a, b) => claveOrden(a) - claveOrden(b) || porTitulo(a, b));
}

const reordenable = () => estado.sesion && estado.orden === "manual" && !estado.texto.trim() && !estado.cat;
let visibles = [];

function pintar() {
  const todosLinks = todos();
  const cats = [...new Set(todosLinks.map(l => l.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  if (estado.cat && !cats.includes(estado.cat)) estado.cat = "";

  const f = $("filtros");
  f.replaceChildren();
  if (cats.length) {
    for (const c of ["", ...cats]) {
      const b = el("button", c === estado.cat ? "on" : "", c || "Todas");
      b.type = "button";
      b.onclick = () => { estado.cat = c; pintar(); };
      f.append(b);
    }
  }
  $("cats").replaceChildren(...cats.map(c => { const o = document.createElement("option"); o.value = c; return o; }));

  visibles = ordenar(todosLinks.filter(coincide));
  const abrir = $("abrir");
  const abribles = estado.cat ? visibles.filter(l => urlSegura(l.url)) : [];
  abrir.hidden = abribles.length < 2;
  abrir.textContent = `Abrir todos (${abribles.length})`;

  const cont = $("lista");
  cont.className = "lista" + (estado.vista === "compacta" ? " compacta" : "");
  $("vista").textContent = estado.vista === "compacta" ? "▦" : "☰";
  cont.replaceChildren(...visibles.map(tarjeta));
  $("vacio").hidden = visibles.length > 0;
}

function tarjeta(l, i) {
  const c = el("article", "card");
  const href = urlSegura(l.url);
  const cab = el("div", "cab");
  // El favicon se pide a un servicio externo: solo para links públicos, para no revelar los hosts privados.
  if (href && l.visibilidad === "publico") {
    const img = el("img");
    img.src = "https://www.google.com/s2/favicons?sz=32&domain=" + encodeURIComponent(new URL(href).hostname);
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    cab.append(img);
  }
  const a = el("a", "t", (l.favorito ? "★ " : "") + (l.visibilidad === "privado" ? "🔒 " : "") + l.titulo);
  if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
  cab.append(a);
  c.append(cab);
  if (href) c.append(el("span", "host", new URL(href).host));
  if (l.descripcion) c.append(el("span", "desc", l.descripcion));

  const pie = el("div", "pie");
  if (l.categoria) pie.append(el("span", "tag cat", l.categoria));
  for (const t of l.etiquetas || []) pie.append(el("span", "tag", "#" + t));
  if (href) {
    const cp = el("button", "cp", "Copiar");
    cp.type = "button";
    cp.title = "Copiar el link";
    cp.onclick = () => copiar(href, cp);
    pie.append(cp);
  }
  if (estado.sesion) {
    if (reordenable()) {
      const sube = el("button", "mv", "↑"), baja = el("button", "mv", "↓");
      sube.type = baja.type = "button";
      sube.setAttribute("aria-label", "Subir");
      baja.setAttribute("aria-label", "Bajar");
      sube.disabled = i === 0;
      baja.disabled = i === visibles.length - 1;
      sube.onclick = () => mover(i, i - 1);
      baja.onclick = () => mover(i, i + 1);
      pie.append(sube, baja);
      activarArrastre(c, i);
    }
    const b = el("button", "ed", "Editar");
    b.type = "button";
    b.onclick = () => abrirForm(l);
    pie.append(b);
  }
  c.append(pie);
  return c;
}

async function copiar(texto, boton) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // Sin permiso del portapapeles: copia con un textarea temporal.
    const t = document.createElement("textarea");
    t.value = texto;
    document.body.append(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    if (!ok) return mensaje("No se pudo copiar el link.", 3000);
  }
  const previo = boton.textContent;
  boton.textContent = "Copiado ✓";
  setTimeout(() => { boton.textContent = previo; }, 1500);
}

$("buscar").oninput = e => { estado.texto = e.target.value; pintar(); };

$("abrir").onclick = () => {
  const urls = visibles.map(l => urlSegura(l.url)).filter(Boolean);
  if (urls.length > 5 && !confirm(`¿Abrir ${urls.length} pestañas?`)) return;
  // El primero va en la pestaña del clic; si el navegador bloquea las demás, se avisa.
  const bloqueadas = urls.filter(u => !window.open(u, "_blank", "noopener")).length;
  if (bloqueadas) mensaje("El navegador bloqueó algunas pestañas: permite ventanas emergentes para este sitio.", 6000);
};

// ── orden manual ──────────────────────────────────────────────────────────
let db, fs;   // se asignan al cargar Firebase

async function mover(de, a) {
  if (a < 0 || a >= visibles.length || de === a) return;
  const arr = [...visibles];
  arr.splice(a, 0, arr.splice(de, 1)[0]);
  const cambios = [];
  arr.forEach((l, i) => { if (l.orden !== i) { l.orden = i; cambios.push(l); } });
  pintar();
  if (!cambios.length) return;
  try {
    for (let i = 0; i < cambios.length; i += 400) {
      const lote = fs.writeBatch(db);
      for (const l of cambios.slice(i, i + 400)) lote.update(fs.doc(db, COL[l.visibilidad], l.id), { orden: l.orden });
      await lote.commit();
    }
  } catch (err) {
    console.error(err);
    mensaje("No se pudo guardar el orden: " + err.code, 5000);
    recargar();
  }
}

let arrastrado = null;
function activarArrastre(c, i) {
  c.draggable = true;
  c.ondragstart = e => { arrastrado = i; c.classList.add("arrastrando"); e.dataTransfer.effectAllowed = "move"; };
  c.ondragend = () => { arrastrado = null; c.classList.remove("arrastrando"); };
  c.ondragover = e => { if (arrastrado !== null) { e.preventDefault(); c.classList.add("sobre"); } };
  c.ondragleave = () => c.classList.remove("sobre");
  c.ondrop = e => {
    e.preventDefault();
    c.classList.remove("sobre");
    if (arrastrado !== null) mover(arrastrado, i);
  };
}

// ── formulario ────────────────────────────────────────────────────────────
const dlg = $("dlg"), form = $("form");
let editando = null;

function abrirForm(l) {
  editando = l || null;
  form.reset();
  $("dlg-titulo").textContent = l ? "Editar link" : "Nuevo link";
  $("borrar").hidden = !l;
  if (l) {
    form.titulo.value = l.titulo || "";
    form.url.value = l.url || "";
    form.descripcion.value = l.descripcion || "";
    form.categoria.value = l.categoria || "";
    form.etiquetas.value = (l.etiquetas || []).join(", ");
    form.visibilidad.value = l.visibilidad;
    form.favorito.checked = !!l.favorito;
  }
  dlg.showModal();
}

$("nuevo").onclick = () => abrirForm(null);
$("cancelar").onclick = () => dlg.close();

// Se actualiza la lista al instante y se escribe en segundo plano; si falla, se recarga del servidor.
form.onsubmit = e => {
  e.preventDefault();
  const enviar = form.querySelector('button[type="submit"]');
  if (enviar.disabled) return;
  const url = urlSegura(form.url.value.trim());
  if (!url) return mensaje("La URL debe empezar con http:// o https://", 4000);
  enviar.disabled = true;
  enviar.textContent = "Guardando…";

  const vis = form.visibilidad.value;
  const previo = editando;
  const id = previo ? previo.id : fs.doc(fs.collection(db, COL[vis])).id;
  const datos = {
    titulo: form.titulo.value.trim(), url,
    descripcion: form.descripcion.value.trim(), categoria: form.categoria.value.trim(),
    etiquetas: etiquetas(form.etiquetas.value), favorito: form.favorito.checked,
    creado: previo?.creado || Date.now(), orden: previo?.orden ?? Date.now(),
  };

  if (previo) lista(previo.visibilidad).splice(lista(previo.visibilidad).indexOf(previo), 1);
  lista(vis).push({ id, visibilidad: vis, ...datos });
  guardarCache();
  dlg.close();
  pintar();
  mensaje("Guardando…");

  (async () => {
    if (previo && previo.visibilidad !== vis) await fs.deleteDoc(fs.doc(db, COL[previo.visibilidad], id));
    await fs.setDoc(fs.doc(db, COL[vis], id), datos);
  })().then(() => mensaje("Guardado ✓", 2000), err => {
    console.error(err);
    mensaje("No se pudo guardar: " + err.code, 5000);
    recargar();
  }).finally(() => { enviar.disabled = false; enviar.textContent = "Guardar"; });
};

$("borrar").onclick = () => {
  const l = editando;
  if (!l || !confirm(`¿Borrar "${l.titulo}"?`)) return;
  lista(l.visibilidad).splice(lista(l.visibilidad).indexOf(l), 1);
  guardarCache();
  dlg.close();
  pintar();
  mensaje("Borrando…");
  fs.deleteDoc(fs.doc(db, COL[l.visibilidad], l.id)).then(() => mensaje("Borrado ✓", 2000), err => {
    console.error(err);
    mensaje("No se pudo borrar: " + err.code, 5000);
    recargar();
  });
};

// ── exportar / importar ───────────────────────────────────────────────────
$("exportar").onclick = () => {
  const datos = todos().map(({ id, ...l }) => l);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }));
  a.download = `links-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$("importar").onchange = async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const arr = JSON.parse(await f.text());
    if (!Array.isArray(arr)) throw new Error("Debe ser una lista");
    const validos = arr.filter(l => l && l.titulo && urlSegura(l.url));
    if (!validos.length) throw new Error("No hay links válidos");
    mensaje("Importando…");
    const base = Date.now();
    for (let i = 0; i < validos.length; i += 400) {
      const lote = fs.writeBatch(db);
      validos.slice(i, i + 400).forEach((l, j) => {
        const vis = l.visibilidad === "publico" ? "publico" : "privado";
        lote.set(fs.doc(fs.collection(db, COL[vis])), {
          titulo: String(l.titulo), url: l.url, descripcion: String(l.descripcion || ""),
          categoria: String(l.categoria || ""), etiquetas: etiquetas((l.etiquetas || []).join(",")),
          favorito: !!l.favorito, creado: base, orden: base + i + j,
        });
      });
      await lote.commit();
    }
    mensaje(`Importados ${validos.length} links.`, 4000);
    recargar();
  } catch (err) { console.error(err); mensaje("No se pudo importar: " + err.message, 6000); }
};

// ── sesión ────────────────────────────────────────────────────────────────
const btn = $("sesion"), dlgLogin = $("dlg-login");
const loginMsg = t => { $("login-msg").textContent = t; };
let auth, am;

btn.onclick = () => {
  if (auth.currentUser) return am.signOut(auth);
  loginMsg("");
  $("clave").value = "";
  dlgLogin.showModal();
};
$("login-cancelar").onclick = () => dlgLogin.close();

$("google").onclick = () => {
  const g = new am.GoogleAuthProvider();
  g.setCustomParameters({ login_hint: OWNER });
  am.signInWithPopup(auth, g).then(() => dlgLogin.close()).catch(e => {
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") loginMsg("No se pudo entrar: " + e.code);
  });
};

$("form-login").onsubmit = e => {
  e.preventDefault();
  const entrar = e.target.querySelector('button[type="submit"]');
  if (entrar.disabled) return;
  entrar.disabled = true;
  entrar.textContent = "Entrando…";
  loginMsg("");
  am.signInWithEmailAndPassword(auth, CLAVE_EMAIL, $("clave").value)
    .then(() => dlgLogin.close())
    .catch(() => loginMsg("Clave incorrecta."))
    .finally(() => { entrar.disabled = false; entrar.textContent = "Entrar"; });
};

// ── carga de datos ────────────────────────────────────────────────────────
function guardarCache() { guardarLocal("cache_publicos", JSON.stringify(estado.publicos)); }

async function leerVis(v, intentos = 2) {
  for (let i = 1; ; i++) {
    try {
      const snap = await fs.getDocs(fs.collection(db, COL[v]));
      return snap.docs.map(d => ({ id: d.id, visibilidad: v, ...d.data() }));
    } catch (err) {
      if (i >= intentos) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function cargarPublicos() {
  try {
    estado.publicos = await leerVis("publico");
    guardarCache();
  } catch (err) {
    console.error(err);
    mensaje("No se pudieron leer los links: " + err.code);
    return;
  }
  mensaje("");
  pintar();
}

async function cargarPrivados() {
  try {
    estado.privados = await leerVis("privado");
  } catch (err) {
    console.error(err);
    mensaje("No se pudieron leer los links privados: " + err.code);
  }
  pintar();
}

function recargar() {
  cargarPublicos();
  if (estado.sesion) cargarPrivados();
}

const esDueno = u => (u.email === OWNER && u.emailVerified) || u.email === CLAVE_EMAIL;

// ── arranque ──────────────────────────────────────────────────────────────
pintar();
if (!estado.publicos.length) mensaje("Cargando…");

const [{ initializeApp }, am_, fs_] = await Promise.all([
  import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js"),
]);
am = am_;
fs = fs_;
const app = initializeApp({
  apiKey: "AIzaSyAES5bP3iCih-Wa7InNXd6x_U6YTiJWgcs",
  authDomain: "my-links-ubbe.firebaseapp.com",
  projectId: "my-links-ubbe",
  storageBucket: "my-links-ubbe.firebasestorage.app",
  messagingSenderId: "451111169159",
  appId: "1:451111169159:web:d545db55bf982ddede1c22",
});
auth = am.getAuth(app);
db = fs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

// Los públicos no necesitan sesión: se piden ya, sin esperar a que Auth responda.
cargarPublicos();

am.onAuthStateChanged(auth, async user => {
  if (user && !esDueno(user)) { await am.signOut(auth); return; }
  estado.sesion = !!user;
  btn.disabled = false;
  btn.textContent = user ? "Cerrar sesión" : "Iniciar sesión";
  $("nuevo").hidden = $("admin").hidden = !user;
  if (user) cargarPrivados();
  else { estado.privados = []; pintar(); }
});
