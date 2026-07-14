/* Belleza Farmasi — tienda con cuentas y pedidos (Firebase) */
(function () {
  "use strict";

  // ---------- Firebase ----------
  let db = null, auth = null, fbReady = false;
  try {
    if (CONFIG.firebase && CONFIG.firebase.apiKey && CONFIG.firebase.apiKey !== "PEGA-AQUI") {
      firebase.initializeApp(CONFIG.firebase);
      auth = firebase.auth();
      db = firebase.firestore();
      fbReady = true;
    }
  } catch (e) { console.error("Firebase:", e); }

  if (CONFIG.emailjs && CONFIG.emailjs.publicKey && window.emailjs) {
    emailjs.init({ publicKey: CONFIG.emailjs.publicKey });
  }

  // ---------- Estado ----------
  let PRODUCTS = [];
  let cart = JSON.parse(localStorage.getItem("bf_cart") || "[]");
  let activeSection = "Todo";
  let searchTerm = "";
  let modalProduct = null, modalPrice = null;
  let user = null, profile = null;
  let authMode = "login";        // "login" | "register"
  let pendingSend = false;       // enviar pedido al terminar login
  let lastOrder = null;

  const SECTION_LABELS = {
    "Makeup": "Maquillaje", "Skincare": "Skincare", "Hair Care": "Cabello",
    "Self Care": "Cuidado Personal", "Man": "Hombre",
    "Fragancias": "Fragancias", "Nutrition": "Nutrición"
  };
  const SECTION_ORDER = ["Todo", "Makeup", "Skincare", "Hair Care", "Fragancias", "Self Care", "Man", "Nutrition"];
  const ESTADOS = { nuevo: "🌸 Nuevo", proceso: "🕐 En proceso", entregado: "✅ Entregado", cancelado: "✖ Cancelado" };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => "$" + n.toFixed(2);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  // ---------- Config visual ----------
  $("storeName").textContent = CONFIG.nombreTienda;
  $("storeTagline").textContent = CONFIG.eslogan;
  $("farmasiLink").href = CONFIG.linkFarmasi;
  document.title = CONFIG.nombreTienda + " · Catálogo y Pedidos";

  // ---------- Catálogo ----------
  fetch("products.json")
    .then((r) => r.json())
    .then((data) => { PRODUCTS = data; renderChips(); render(); updateCartUI(); })
    .catch(() => { $("resultsInfo").textContent = "No se pudo cargar el catálogo. Recarga la página."; });

  function renderChips() {
    const counts = {};
    PRODUCTS.forEach((p) => { counts[p.section] = (counts[p.section] || 0) + 1; });
    const chips = SECTION_ORDER.filter((s) => s === "Todo" || counts[s]);
    $("chips").innerHTML = chips.map((s) => {
      const n = s === "Todo" ? PRODUCTS.length : counts[s];
      const label = s === "Todo" ? "Todo" : (SECTION_LABELS[s] || s);
      return '<button class="chip' + (s === activeSection ? " active" : "") + '" data-s="' + s + '">' +
        label + '<span class="n">' + n + "</span></button>";
    }).join("");
    $("chips").querySelectorAll(".chip").forEach((b) => {
      b.addEventListener("click", () => {
        activeSection = b.dataset.s;
        renderChips(); render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function visibleProducts() {
    const t = searchTerm.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (activeSection !== "Todo" && p.section !== activeSection) return false;
      if (!t) return true;
      return (p.name + " " + (SECTION_LABELS[p.section] || p.section)).toLowerCase().includes(t);
    });
  }

  function render() {
    const list = visibleProducts();
    $("resultsInfo").textContent = list.length + " producto" + (list.length === 1 ? "" : "s") +
      (activeSection !== "Todo" ? " en " + (SECTION_LABELS[activeSection] || activeSection) : "") +
      (searchTerm ? ' para "' + searchTerm + '"' : "");
    $("grid").innerHTML = list.map((p) => {
      const multi = p.prices.length > 1;
      const price = multi
        ? '<span class="from">desde </span>' + fmt(Math.min.apply(null, p.prices))
        : fmt(p.prices[0]);
      return '<article class="card">' +
        '<div class="card-img" data-view="' + p.id + '" title="Ver página del catálogo">' +
          '<img loading="lazy" src="' + p.img + '" alt="' + esc(p.name) + ' — página del catálogo">' +
          '<span class="zoom-hint">Ver página ✦</span>' +
        "</div>" +
        '<div class="card-body">' +
          '<span class="card-section">' + (SECTION_LABELS[p.section] || p.section) + "</span>" +
          '<h3 class="card-name">' + esc(p.name) + "</h3>" +
          '<span class="card-price">' + price + "</span>" +
          '<button class="card-add" data-add="' + p.id + '">Agregar al pedido</button>' +
        "</div></article>";
    }).join("");
    $("grid").querySelectorAll("[data-view]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(el.dataset.view)));
    $("grid").querySelectorAll("[data-add]").forEach((el) =>
      el.addEventListener("click", () => openModal(el.dataset.add)));
  }

  $("searchInput").addEventListener("input", (e) => { searchTerm = e.target.value; render(); });

  // ---------- Lightbox ----------
  function openLightbox(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    $("lightboxImg").src = p.img;
    $("lightbox").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() { $("lightbox").hidden = true; document.body.style.overflow = ""; }
  $("lightboxClose").addEventListener("click", closeLightbox);
  $("lightbox").addEventListener("click", (e) => { if (e.target === $("lightbox")) closeLightbox(); });

  // ---------- Modal agregar ----------
  function openModal(id) {
    modalProduct = PRODUCTS.find((x) => x.id === id);
    if (!modalProduct) return;
    modalPrice = modalProduct.prices[0];
    $("modalProduct").textContent = modalProduct.name;
    $("qtyInput").value = 1;
    $("noteInput").value = "";
    const multi = modalProduct.prices.length > 1;
    $("variantField").style.display = multi ? "" : "none";
    if (multi) {
      $("variantRow").innerHTML = modalProduct.prices.map((pr, i) =>
        '<button type="button" class="variant' + (i === 0 ? " active" : "") + '" data-p="' + pr + '">' + fmt(pr) + "</button>"
      ).join("");
      $("variantRow").querySelectorAll(".variant").forEach((b) => {
        b.addEventListener("click", () => {
          modalPrice = parseFloat(b.dataset.p);
          $("variantRow").querySelectorAll(".variant").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
        });
      });
    }
    $("modalBackdrop").hidden = false;
  }
  function closeModal() { $("modalBackdrop").hidden = true; modalProduct = null; }
  $("modalCancel").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", (e) => { if (e.target === $("modalBackdrop")) closeModal(); });
  $("qtyMinus").addEventListener("click", () => { $("qtyInput").value = Math.max(1, (+$("qtyInput").value || 1) - 1); });
  $("qtyPlus").addEventListener("click", () => { $("qtyInput").value = (+$("qtyInput").value || 1) + 1; });

  $("modalAdd").addEventListener("click", () => {
    if (!modalProduct) return;
    const qty = Math.max(1, +$("qtyInput").value || 1);
    const note = $("noteInput").value.trim();
    const key = modalProduct.id + "|" + modalPrice + "|" + note.toLowerCase();
    const found = cart.find((c) => c.key === key);
    if (found) found.qty += qty;
    else cart.push({ key, id: modalProduct.id, name: modalProduct.name, img: modalProduct.img, price: modalPrice, qty, note });
    saveCart(); closeModal(); updateCartUI();
    showToast("Agregado a tu pedido ✓");
  });

  function saveCart() { localStorage.setItem("bf_cart", JSON.stringify(cart)); }

  // ---------- Carrito ----------
  function updateCartUI() {
    const count = cart.reduce((s, c) => s + c.qty, 0);
    $("cartCount").textContent = count;
    const total = cart.reduce((s, c) => s + c.qty * c.price, 0);
    $("totalAmount").textContent = fmt(total);
    $("drawerItems").innerHTML = cart.map((c, i) =>
      '<div class="item">' +
        '<img src="' + c.img + '" alt="">' +
        "<div>" +
          '<div class="item-name">' + esc(c.name) + "</div>" +
          (c.note ? '<div class="item-note">' + esc(c.note) + "</div>" : "") +
          '<div class="item-price">' + fmt(c.price) + " c/u</div>" +
        "</div>" +
        '<div class="item-ctrl">' +
          '<div class="item-qty">' +
            '<button data-m="' + i + '" aria-label="Menos">−</button>' +
            "<span>" + c.qty + "</span>" +
            '<button data-p="' + i + '" aria-label="Más">+</button>' +
          "</div>" +
          '<button class="item-del" data-d="' + i + '">quitar</button>' +
        "</div></div>"
    ).join("");
    $("drawerEmpty").style.display = cart.length ? "none" : "flex";
    $("drawerFoot").style.display = cart.length ? "" : "none";
    $("drawerItems").querySelectorAll("[data-m]").forEach((b) =>
      b.addEventListener("click", () => { const c = cart[+b.dataset.m]; c.qty > 1 ? c.qty-- : cart.splice(+b.dataset.m, 1); saveCart(); updateCartUI(); }));
    $("drawerItems").querySelectorAll("[data-p]").forEach((b) =>
      b.addEventListener("click", () => { cart[+b.dataset.p].qty++; saveCart(); updateCartUI(); }));
    $("drawerItems").querySelectorAll("[data-d]").forEach((b) =>
      b.addEventListener("click", () => { cart.splice(+b.dataset.d, 1); saveCart(); updateCartUI(); }));
  }

  function openDrawer() { $("drawer").hidden = false; $("drawerBackdrop").hidden = false; document.body.style.overflow = "hidden"; }
  function closeDrawer() { $("drawer").hidden = true; $("drawerBackdrop").hidden = true; document.body.style.overflow = ""; }
  $("cartBtn").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerBackdrop").addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeLightbox(); closeModal(); closeDrawer(); closeAuth(); closeAcct(); closeOrderDone(); }
  });

  // ---------- Autenticación ----------
  function setAuthMode(mode) {
    authMode = mode;
    const reg = mode === "register";
    $("authTitle").textContent = reg ? "Crear cuenta" : "Entrar";
    $("authSubmit").textContent = reg ? "Crear cuenta" : "Entrar";
    $("authSwitch").innerHTML = reg
      ? "¿Ya tienes cuenta? <strong>Entrar</strong>"
      : "¿No tienes cuenta? <strong>Crear cuenta</strong>";
    $("fNombre").hidden = !reg;
    $("fTel").hidden = !reg;
    $("fDir").hidden = !reg;
    $("authError").hidden = true;
  }
  function openAuth(mode) {
    if (!fbReady) { showToast("La tienda aún no está conectada (falta Firebase)"); return; }
    setAuthMode(mode || "login");
    $("authBackdrop").hidden = false;
  }
  function closeAuth() { $("authBackdrop").hidden = true; pendingSend = false; }
  $("authCancel").addEventListener("click", closeAuth);
  $("authBackdrop").addEventListener("click", (e) => { if (e.target === $("authBackdrop")) closeAuth(); });
  $("authSwitch").addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));

  function authErr(msg) { $("authError").textContent = msg; $("authError").hidden = false; }

  $("authSubmit").addEventListener("click", async () => {
    const email = $("authEmail").value.trim();
    const pass = $("authPass").value;
    if (!email || !pass) return authErr("Escribe tu correo y contraseña.");
    $("authSubmit").disabled = true;
    try {
      if (authMode === "register") {
        const nombre = $("regNombre").value.trim();
        const tel = $("regTel").value.trim();
        if (!nombre || !tel) { authErr("Escribe tu nombre y teléfono."); $("authSubmit").disabled = false; return; }
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection("usuarios").doc(cred.user.uid).set({
          nombre, telefono: tel, correo: email,
          direccion: $("regDir").value.trim(),
          creado: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await auth.signInWithEmailAndPassword(email, pass);
      }
      closeAuth();
      $("authBackdrop").hidden = true;
      if (pendingSend) { pendingSend = false; setTimeout(sendOrder, 400); }
    } catch (e) {
      const m = {
        "auth/email-already-in-use": "Ese correo ya tiene cuenta. Prueba «Entrar».",
        "auth/invalid-email": "El correo no es válido.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/user-not-found": "No hay cuenta con ese correo. Crea una.",
        "auth/wrong-password": "Contraseña incorrecta."
      };
      authErr(m[e.code] || "No se pudo completar. Intenta de nuevo.");
    }
    $("authSubmit").disabled = false;
  });

  if (fbReady) {
    auth.onAuthStateChanged(async (u) => {
      user = u;
      if (u) {
        try {
          const doc = await db.collection("usuarios").doc(u.uid).get();
          profile = doc.exists ? doc.data() : { nombre: u.email, telefono: "", correo: u.email };
        } catch (e) { profile = { nombre: u.email, telefono: "", correo: u.email }; }
        $("acctLabel").textContent = (profile.nombre || "Mi cuenta").split(" ")[0];
        if (profile.direccion && !$("clientAddr").value) $("clientAddr").value = profile.direccion;
      } else {
        profile = null;
        $("acctLabel").textContent = "Entrar";
      }
    });
  }

  // ---------- Mi cuenta / mis pedidos ----------
  function closeAcct() { $("acctBackdrop").hidden = true; }
  $("acctClose").addEventListener("click", closeAcct);
  $("acctBackdrop").addEventListener("click", (e) => { if (e.target === $("acctBackdrop")) closeAcct(); });
  $("logoutBtn").addEventListener("click", async () => { await auth.signOut(); closeAcct(); showToast("Sesión cerrada"); });

  $("acctBtn").addEventListener("click", async () => {
    if (!user) { openAuth("login"); return; }
    $("acctName").textContent = (profile && profile.nombre) || "";
    $("acctEmail").textContent = user.email;
    $("acctBackdrop").hidden = false;
    $("myOrders").innerHTML = '<p class="muted">Cargando…</p>';
    try {
      const snap = await db.collection("pedidos").where("uid", "==", user.uid).get();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoMs || 0) - (a.creadoMs || 0));
      if (!docs.length) { $("myOrders").innerHTML = '<p class="muted">Aún no tienes pedidos.</p>'; return; }
      $("myOrders").innerHTML = docs.map((o) =>
        '<div class="mini-order">' +
          "<div><strong>#" + esc(o.numero) + "</strong> · " + fmt(o.total) + "</div>" +
          '<div class="mini-status">' + (ESTADOS[o.estado] || o.estado) + " · " + (o.items || []).reduce((s, i) => s + i.qty, 0) + " art.</div>" +
        "</div>"
      ).join("");
    } catch (e) {
      $("myOrders").innerHTML = '<p class="muted">No se pudieron cargar tus pedidos.</p>';
    }
  });

  // ---------- Compartir pedido ----------
  function orderText(p) {
    const c = p.cliente || {};
    const L = [];
    L.push("PEDIDO #" + p.numero + " - " + CONFIG.nombreTienda);
    L.push("");
    (p.items || []).forEach((i, n) => {
      L.push((n + 1) + ") " + i.name + (i.note ? " [" + i.note + "]" : ""));
      L.push("   " + i.qty + " x " + fmt(i.price) + " = " + fmt(i.qty * i.price));
    });
    L.push("");
    L.push("TOTAL: " + fmt(p.total) + " " + CONFIG.moneda);
    L.push("");
    L.push("Cliente: " + (c.nombre || ""));
    L.push("Telefono: " + (c.telefono || ""));
    L.push("Correo: " + (c.correo || ""));
    if (c.direccion) L.push("Entrega: " + c.direccion);
    return L.join("\n");
  }

  async function shareOrder(p) {
    if (!p) return;
    const text = orderText(p);
    const title = "Pedido #" + p.numero + " - " + CONFIG.nombreTienda;
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    copyText(text)
      .then(() => showToast("Tu equipo no abrió compartir; pedido copiado ✓"))
      .catch(() => showToast("No se pudo compartir"));
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

  function openOrderDone(p) {
    lastOrder = p;
    $("doneTitle").textContent = "Pedido #" + p.numero + " enviado";
    $("doneText").textContent = "Ya quedó registrado. También puedes compartirlo por WhatsApp, correo u otra app.";
    $("doneBackdrop").hidden = false;
  }
  function closeOrderDone() { $("doneBackdrop").hidden = true; }
  $("doneClose").addEventListener("click", closeOrderDone);
  $("doneShare").addEventListener("click", () => shareOrder(lastOrder));
  $("doneBackdrop").addEventListener("click", (e) => { if (e.target === $("doneBackdrop")) closeOrderDone(); });

  // ---------- Enviar pedido ----------
  async function sendOrder() {
    if (!cart.length) { showToast("Tu pedido está vacío"); return; }
    if (!fbReady) { showToast("La tienda aún no está conectada (falta Firebase)"); return; }
    if (!user) { pendingSend = true; closeDrawer(); openAuth("login"); showToast("Entra o crea tu cuenta para enviar el pedido"); return; }

    $("sendOrder").disabled = true;
    $("sendOrder").textContent = "Enviando…";
    const total = cart.reduce((s, c) => s + c.qty * c.price, 0);
    const numero = Date.now().toString(36).toUpperCase().slice(-6);
    const direccion = $("clientAddr").value.trim() || (profile && profile.direccion) || "";
    const pedido = {
      numero, uid: user.uid,
      cliente: {
        nombre: (profile && profile.nombre) || user.email,
        telefono: (profile && profile.telefono) || "",
        correo: user.email,
        direccion
      },
      items: cart.map((c) => ({ name: c.name, price: c.price, qty: c.qty, note: c.note || "" })),
      total, estado: "nuevo",
      creado: firebase.firestore.FieldValue.serverTimestamp(),
      creadoMs: Date.now()
    };
    try {
      await db.collection("pedidos").add(pedido);
      notifyEmail(pedido);
      cart = []; saveCart(); updateCartUI(); closeDrawer();
      openOrderDone(pedido);
      showToast("¡Pedido #" + numero + " enviado!");
    } catch (e) {
      console.error(e);
      showToast("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    }
    $("sendOrder").disabled = false;
    $("sendOrder").textContent = "Enviar pedido ✨";
  }
  $("sendOrder").addEventListener("click", sendOrder);

  function notifyEmail(p) {
    const ej = CONFIG.emailjs;
    if (!ej || !ej.publicKey || !ej.serviceId || !ej.templateId || !window.emailjs) return;
    const detalle = p.items.map((i, n) =>
      (n + 1) + ") " + i.name + (i.note ? " [" + i.note + "]" : "") +
      " — " + i.qty + " × " + fmt(i.price)).join("\n");
    emailjs.send(ej.serviceId, ej.templateId, {
      pedido: p.numero,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      correo: p.cliente.correo,
      direccion: p.cliente.direccion || "—",
      total: fmt(p.total) + " " + CONFIG.moneda,
      detalle
    }).catch((e) => console.warn("EmailJS:", e));
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg) {
    $("toast").textContent = msg;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
  }
})();
