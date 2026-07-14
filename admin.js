/* Panel de administración — Belleza Farmasi */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => "$" + Number(n).toFixed(2);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  const ESTADOS = [
    ["nuevo", "🌸 Nuevo"],
    ["proceso", "🕐 En proceso"],
    ["entregado", "✅ Entregado"],
    ["cancelado", "✖ Cancelado"]
  ];
  const ELABEL = Object.fromEntries(ESTADOS);

  let orders = [], users = [], filtro = "todos", expanded = null, unsub = null;
  const adminEmails = ((CONFIG.adminEmails && CONFIG.adminEmails.length) ? CONFIG.adminEmails : [CONFIG.adminEmail])
    .map((e) => String(e || "").trim().toLowerCase())
    .filter(Boolean);

  // ---------- Firebase ----------
  if (!CONFIG.firebase || CONFIG.firebase.apiKey === "PEGA-AQUI") {
    document.body.innerHTML = '<p style="padding:2rem;text-align:center;font-family:sans-serif">Falta configurar Firebase en <b>config.js</b>. Revisa el README.</p>';
    return;
  }
  firebase.initializeApp(CONFIG.firebase);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // ---------- Acceso ----------
  function admError(m) { $("admError").textContent = m; $("admError").hidden = false; }
  function isAdminEmail(email) { return adminEmails.includes(String(email || "").trim().toLowerCase()); }

  $("admEnter").addEventListener("click", async () => {
    const email = $("admEmail").value.trim();
    const pass = $("admPass").value;
    if (!email || !pass) return admError("Escribe tu correo y contraseña.");
    if (!isAdminEmail(email))
      return admError("Este correo no está autorizado para vender.");
    $("admEnter").disabled = true;
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
      if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
        // primera vez: crear la cuenta admin
        try { await auth.createUserWithEmailAndPassword(email, pass); }
        catch (e2) {
          admError(e2.code === "auth/weak-password"
            ? "La contraseña debe tener al menos 6 caracteres."
            : e2.code === "auth/email-already-in-use"
              ? "Contraseña incorrecta."
              : "No se pudo entrar. Intenta de nuevo.");
        }
      } else if (e.code === "auth/wrong-password") {
        admError("Contraseña incorrecta.");
      } else {
        admError("No se pudo entrar. Intenta de nuevo.");
      }
    }
    $("admEnter").disabled = false;
  });

  $("admLogout").addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged((u) => {
    const isAdmin = u && u.email && isAdminEmail(u.email);
    $("adminLogin").hidden = !!isAdmin;
    $("adminPanel").hidden = !isAdmin;
    if (isAdmin) {
      $("admWho").textContent = u.email;
      listen();
      loadUsers();
    } else if (unsub) { unsub(); unsub = null; }
  });

  // ---------- Pedidos en tiempo real ----------
  function listen() {
    if (unsub) unsub();
    unsub = db.collection("pedidos").onSnapshot((snap) => {
      orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoMs || 0) - (a.creadoMs || 0));
      renderChips();
      renderOrders();
    }, (e) => {
      $("ordersList").innerHTML = '<p class="muted center">No se pudieron cargar los pedidos.<br>Revisa las reglas de Firestore (README).</p>';
      console.error(e);
    });
  }

  function renderChips() {
    const counts = { todos: orders.length };
    ESTADOS.forEach(([k]) => { counts[k] = orders.filter((o) => o.estado === k).length; });
    const all = [["todos", "Todos"]].concat(ESTADOS);
    $("estadoChips").innerHTML = all.map(([k, label]) =>
      '<button class="chip' + (filtro === k ? " active" : "") + '" data-f="' + k + '">' +
      label + '<span class="n">' + counts[k] + "</span></button>"
    ).join("");
    $("estadoChips").querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => { filtro = b.dataset.f; renderChips(); renderOrders(); }));
    $("nPedidos").textContent = orders.length;
  }

  function fecha(ms) {
    if (!ms) return "";
    return new Date(ms).toLocaleString("es-CR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function renderOrders() {
    const list = filtro === "todos" ? orders : orders.filter((o) => o.estado === filtro);
    if (!list.length) {
      $("ordersList").innerHTML = '<p class="muted center">No hay pedidos ' + (filtro === "todos" ? "todavía." : "en este estado.") + "</p>";
      return;
    }
    $("ordersList").innerHTML = list.map((o) => {
      const nItems = (o.items || []).reduce((s, i) => s + i.qty, 0);
      const open = expanded === o.id;
      return '<article class="order-card' + (open ? " open" : "") + '" data-id="' + o.id + '">' +
        '<button class="order-head" data-toggle="' + o.id + '">' +
          "<div>" +
            '<div class="order-num">#' + esc(o.numero) + ' <span class="badge ' + esc(o.estado) + '">' + (ELABEL[o.estado] || o.estado) + "</span></div>" +
            '<div class="order-meta">' + esc(o.cliente && o.cliente.nombre) + " · " + nItems + " art. · <strong>" + fmt(o.total) + "</strong></div>" +
            '<div class="order-date">' + fecha(o.creadoMs) + "</div>" +
          "</div>" +
          '<span class="chev">' + (open ? "▲" : "▼") + "</span>" +
        "</button>" +
        (open ? orderDetail(o) : "") +
      "</article>";
    }).join("");

    $("ordersList").querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => { expanded = expanded === b.dataset.toggle ? null : b.dataset.toggle; renderOrders(); }));
    $("ordersList").querySelectorAll("[data-estado]").forEach((s) =>
      s.addEventListener("change", async () => {
        try { await db.collection("pedidos").doc(s.dataset.estado).update({ estado: s.value }); toast("Estado actualizado ✓"); }
        catch (e) { toast("No se pudo actualizar"); }
      }));
    $("ordersList").querySelectorAll("[data-dl]").forEach((b) =>
      b.addEventListener("click", () => downloadOrder(orders.find((o) => o.id === b.dataset.dl))));
    $("ordersList").querySelectorAll("[data-copy]").forEach((b) =>
      b.addEventListener("click", () => {
        copyText(orderText(orders.find((o) => o.id === b.dataset.copy)))
          .then(() => toast("Pedido copiado ✓")).catch(() => toast("No se pudo copiar"));
      }));
    $("ordersList").querySelectorAll("[data-share]").forEach((b) =>
      b.addEventListener("click", () => shareOrder(orders.find((o) => o.id === b.dataset.share))));
  }

  function orderDetail(o) {
    const c = o.cliente || {};
    const items = (o.items || []).map((i, n) =>
      '<div class="oi"><span>' + (n + 1) + ") " + esc(i.name) +
      (i.note ? ' <em class="oi-note">' + esc(i.note) + "</em>" : "") +
      "</span><span>" + i.qty + " × " + fmt(i.price) + "</span></div>"
    ).join("");
    const tel = (c.telefono || "").replace(/\D/g, "");
    return '<div class="order-body">' +
      '<div class="order-client">' +
        "<div>👤 " + esc(c.nombre) + "</div>" +
        (c.telefono ? '<div>📞 <a href="tel:' + esc(c.telefono) + '">' + esc(c.telefono) + "</a>" +
          (tel ? ' · <a href="https://wa.me/' + tel + '" target="_blank" rel="noopener">WhatsApp</a>' : "") + "</div>" : "") +
        (c.correo ? '<div>✉️ <a href="mailto:' + esc(c.correo) + '">' + esc(c.correo) + "</a></div>" : "") +
        (c.direccion ? "<div>📍 " + esc(c.direccion) + "</div>" : "") +
      "</div>" +
      '<div class="order-items">' + items + "</div>" +
      '<div class="order-total">Total <strong>' + fmt(o.total) + "</strong></div>" +
      '<div class="field"><label>Estado</label>' +
        '<select class="estado-sel" data-estado="' + o.id + '">' +
          ESTADOS.map(([k, l]) => '<option value="' + k + '"' + (o.estado === k ? " selected" : "") + ">" + l + "</option>").join("") +
        "</select></div>" +
      '<div class="order-actions">' +
        '<button class="btn solid small" data-share="' + o.id + '">Compartir</button>' +
        '<button class="btn ghost small" data-copy="' + o.id + '">Copiar</button>' +
        '<button class="btn ghost small" data-dl="' + o.id + '">Descargar .txt</button>' +
      "</div>" +
    "</div>";
  }

  function orderText(o) {
    const c = o.cliente || {};
    const L = [];
    L.push("PEDIDO #" + o.numero + " — " + CONFIG.nombreTienda);
    L.push("Fecha: " + fecha(o.creadoMs));
    L.push("Estado: " + (ELABEL[o.estado] || o.estado));
    L.push("");
    (o.items || []).forEach((i, n) => {
      L.push((n + 1) + ") " + i.name + (i.note ? " [" + i.note + "]" : ""));
      L.push("   " + i.qty + " x " + fmt(i.price) + " = " + fmt(i.qty * i.price));
    });
    L.push("");
    L.push("TOTAL: " + fmt(o.total) + " " + CONFIG.moneda);
    L.push("");
    L.push("Cliente: " + (c.nombre || ""));
    L.push("Telefono: " + (c.telefono || ""));
    L.push("Correo: " + (c.correo || ""));
    if (c.direccion) L.push("Entrega: " + c.direccion);
    return L.join("\n");
  }

  async function shareOrder(o) {
    if (!o) return;
    const text = orderText(o);
    const title = "Pedido #" + o.numero + " - " + CONFIG.nombreTienda;
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    copyText(text)
      .then(() => toast("Tu equipo no abrió compartir; pedido copiado ✓"))
      .catch(() => toast("No se pudo compartir"));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.focus();
      area.select();
      try { document.execCommand("copy") ? resolve() : reject(new Error("copy failed")); }
      catch (e) { reject(e); }
      finally { area.remove(); }
    });
  }

  function downloadOrder(o) {
    const blob = new Blob([orderText(o)], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pedido-" + o.numero + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Clientes ----------
  async function loadUsers() {
    try {
      const snap = await db.collection("usuarios").get();
      users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      $("nClientes").textContent = users.length;
      renderUsers();
    } catch (e) {
      $("usersList").innerHTML = '<p class="muted center">No se pudieron cargar los clientes.</p>';
    }
  }

  function renderUsers() {
    if (!users.length) {
      $("usersList").innerHTML = '<p class="muted center">Aún no hay clientes registrados.</p>';
      return;
    }
    $("usersList").innerHTML = users.map((u) => {
      const n = orders.filter((o) => o.uid === u.id).length;
      const tel = (u.telefono || "").replace(/\D/g, "");
      return '<article class="user-card">' +
        '<div class="user-avatar">' + esc((u.nombre || "?").trim().charAt(0).toUpperCase()) + "</div>" +
        "<div>" +
          '<div class="user-name">' + esc(u.nombre) + "</div>" +
          '<div class="user-meta">' +
            (u.telefono ? '📞 <a href="tel:' + esc(u.telefono) + '">' + esc(u.telefono) + "</a>" +
              (tel ? ' · <a href="https://wa.me/' + tel + '" target="_blank" rel="noopener">WhatsApp</a>' : "") + "<br>" : "") +
            (u.correo ? "✉️ " + esc(u.correo) + "<br>" : "") +
            (u.direccion ? "📍 " + esc(u.direccion) + "<br>" : "") +
            "🛍️ " + n + " pedido" + (n === 1 ? "" : "s") +
          "</div>" +
        "</div>" +
      "</article>";
    }).join("");
  }

  // ---------- Tabs ----------
  document.querySelectorAll(".atab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".atab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $("tabPedidos").hidden = t.dataset.tab !== "pedidos";
      $("tabClientes").hidden = t.dataset.tab !== "clientes";
      if (t.dataset.tab === "clientes") renderUsers();
    }));

  // ---------- Toast ----------
  let tt = null;
  function toast(m) {
    $("toast").textContent = m;
    $("toast").hidden = false;
    clearTimeout(tt);
    tt = setTimeout(() => { $("toast").hidden = true; }, 2200);
  }
})();
