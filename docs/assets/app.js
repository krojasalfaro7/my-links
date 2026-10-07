// Mis links: lista pública + privados y panel de gestión con sesión (Google o clave).
// La config de Firebase es pública por diseño; lo que protege los datos son las reglas (firestore.rules).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { initializeFirestore, collection, doc, getDocs, setDoc, deleteDoc, writeBatch }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const OWNER = "krojas.alfaro7@gmail.com";
const CLAVE_EMAIL = "krojas.alfaro7+links@gmail.com";
const COL = { publico: "links_publicos", privado: "links_privados" };

const app = initializeApp({
  apiKey: "AIzaSyAES5bP3iCih-Wa7InNXd6x_U6YTiJWgcs",
  authDomain: "my-links-ubbe.firebaseapp.com",
  projectId: "my-links-ubbe",
  storageBucket: "my-links-ubbe.firebasestorage.app",
  messagingSenderId: "451111169159",
  appId: "1:451111169159:web:d545db55bf982ddede1c22",
});
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
const google = new GoogleAuthProvider();
google.setCustomParameters({ login_hint: OWNER });

const $ = id => document.getElementById(id);
const estado = { links: [], sesion: false, texto: "", cat: "" };

// ── tema ──────────────────────────────────────────────────────────────────
const root = document.documentElement;
try { const t = localStorage.getItem("tema"); if (t) root.dataset.theme = t; } catch {}
$("tema").onclick = () => {
  const oscuro = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = oscuro ? "light" : "dark";
  try { localStorage.setItem("tema", root.dataset.theme); } catch {}
};

// ── datos ─────────────────────────────────────────────────────────────────
const urlSegura = u => { try { return /^https?:$/.test(new URL(u).protocol) ? u : ""; } catch { return ""; } };
const etiquetas = s => [...new Set(String(s || "").split(",").map(x => x.trim()).filter(Boolean))];

async function cargar() {
  const vis = estado.sesion ? ["publico", "privado"] : ["publico"];
  const res = await Promise.all(vis.map(async v => {
    const snap = await getDocs(collection(db, COL[v]));
    return snap.docs.map(d => ({ id: d.id, visibilidad: v, ...d.data() }));
  }));
  estado.links = res.flat();
  pintar();
}

// ── lista ─────────────────────────────────────────────────────────────────
function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto;
  return e;
}

function coincide(l) {
  if (estado.cat && l.categoria !== estado.cat) return false;
  const q = estado.texto.trim().toLowerCase();
  if (!q) return true;
  return [l.titulo, l.url, l.descripcion, l.categoria, ...(l.etiquetas || [])].join(" ").toLowerCase().includes(q);
}

function pintar() {
  const cats = [...new Set(estado.links.map(l => l.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
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

  const visibles = estado.links.filter(coincide).sort((a, b) =>
    (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0) || String(a.titulo).localeCompare(String(b.titulo), "es"));
  const lista = $("lista");
  lista.replaceChildren(...visibles.map(tarjeta));
  $("vacio").hidden = visibles.length > 0;
}

function tarjeta(l) {
  const c = el("article", "card");
  const href = urlSegura(l.url);
  const a = el("a", "t", (l.favorito ? "★ " : "") + (l.visibilidad === "privado" ? "🔒 " : "") + l.titulo);
  if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
  c.append(a);
  if (href) c.append(el("span", "host", new URL(href).host));
  if (l.descripcion) c.append(el("span", "desc", l.descripcion));
  const pie = el("div", "pie");
  if (l.categoria) pie.append(el("span", "tag cat", l.categoria));
  for (const t of l.etiquetas || []) pie.append(el("span", "tag", "#" + t));
  if (estado.sesion) {
    const b = el("button", "ed", "Editar");
    b.type = "button";
    b.onclick = () => abrirForm(l);
    pie.append(b);
  }
  c.append(pie);
  return c;
}

$("buscar").oninput = e => { estado.texto = e.target.value; pintar(); };

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

form.onsubmit = async e => {
  e.preventDefault();
  const url = urlSegura(form.url.value.trim());
  if (!url) return mensaje("La URL debe empezar con http:// o https://");
  const datos = {
    titulo: form.titulo.value.trim(), url,
    descripcion: form.descripcion.value.trim(), categoria: form.categoria.value.trim(),
    etiquetas: etiquetas(form.etiquetas.value), favorito: form.favorito.checked,
  };
  const vis = form.visibilidad.value;
  try {
    if (editando && editando.visibilidad !== vis) await deleteDoc(doc(db, COL[editando.visibilidad], editando.id));
    const ref = editando ? doc(db, COL[vis], editando.id) : doc(collection(db, COL[vis]));
    await setDoc(ref, { ...datos, creado: editando?.creado || Date.now() });
    dlg.close();
    await cargar();
  } catch (err) { console.error(err); mensaje("No se pudo guardar: " + err.code); }
};

$("borrar").onclick = async () => {
  if (!editando || !confirm(`¿Borrar "${editando.titulo}"?`)) return;
  try {
    await deleteDoc(doc(db, COL[editando.visibilidad], editando.id));
    dlg.close();
    await cargar();
  } catch (err) { console.error(err); mensaje("No se pudo borrar: " + err.code); }
};

// ── exportar / importar ───────────────────────────────────────────────────
$("exportar").onclick = () => {
  const datos = estado.links.map(({ id, ...l }) => l);
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
    for (let i = 0; i < validos.length; i += 400) {
      const lote = writeBatch(db);
      for (const l of validos.slice(i, i + 400)) {
        const vis = l.visibilidad === "publico" ? "publico" : "privado";
        lote.set(doc(collection(db, COL[vis])), {
          titulo: String(l.titulo), url: l.url, descripcion: String(l.descripcion || ""),
          categoria: String(l.categoria || ""), etiquetas: etiquetas((l.etiquetas || []).join(",")),
          favorito: !!l.favorito, creado: Date.now(),
        });
      }
      await lote.commit();
    }
    mensaje(`Importados ${validos.length} links.`);
    await cargar();
  } catch (err) { console.error(err); mensaje("No se pudo importar: " + err.message); }
};

// ── sesión ────────────────────────────────────────────────────────────────
const btn = $("sesion"), dlgLogin = $("dlg-login");
const loginMsg = t => { $("login-msg").textContent = t; };
function mensaje(t) { $("msg").textContent = t; }

btn.onclick = () => {
  if (auth.currentUser) return signOut(auth);
  loginMsg("");
  $("clave").value = "";
  dlgLogin.showModal();
};
$("login-cancelar").onclick = () => dlgLogin.close();

$("google").onclick = () => signInWithPopup(auth, google).then(() => dlgLogin.close()).catch(e => {
  if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") loginMsg("No se pudo entrar: " + e.code);
});

$("form-login").onsubmit = e => {
  e.preventDefault();
  signInWithEmailAndPassword(auth, CLAVE_EMAIL, $("clave").value)
    .then(() => dlgLogin.close())
    .catch(() => loginMsg("Clave incorrecta."));
};

const esDueno = u => (u.email === OWNER && u.emailVerified) || u.email === CLAVE_EMAIL;

onAuthStateChanged(auth, async user => {
  if (user && !esDueno(user)) { await signOut(auth); return; }
  estado.sesion = !!user;
  btn.disabled = false;
  btn.textContent = user ? "Cerrar sesión" : "Iniciar sesión";
  $("nuevo").hidden = $("admin").hidden = !user;
  mensaje("");
  try { await cargar(); }
  catch (err) { console.error(err); estado.links = []; pintar(); mensaje("No se pudieron leer los links: " + err.code); }
});
