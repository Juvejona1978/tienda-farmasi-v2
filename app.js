/* Belleza Farmasi - catalogo con pedido compartible */
(function () {
  "use strict";

  let PRODUCTS = [];
  let cart = JSON.parse(localStorage.getItem("bf_cart") || "[]");
  let activeSection = "Todo";
  let searchTerm = "";
  let modalProduct = null;
  let modalPrice = null;

  const SECTION_LABELS = {
    "Makeup": "Maquillaje",
    "Skincare": "Skincare",
    "Hair Care": "Cabello",
    "Self Care": "Cuidado Personal",
    "Man": "Hombre",
    "Fragancias": "Fragancias",
    "Nutrition": "Nutricion"
  };
  const SECTION_ORDER = ["Todo", "Makeup", "Skincare", "Hair Care", "Fragancias", "Self Care", "Man", "Nutrition"];

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => "$" + Number(n || 0).toFixed(2);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");

  $("storeName").textContent = CONFIG.nombreTienda;
  $("storeTagline").textContent = CONFIG.eslogan;
  $("farmasiLink").href = CONFIG.linkFarmasi;
  $("whatsappTopLink").href = "https://wa.me/" + CONFIG.whatsappNumero;
  document.title = CONFIG.nombreTienda + " - Catalogo";

  fetch("products.json")
    .then((r) => r.json())
    .then((data) => {
      PRODUCTS = data;
      renderChips();
      renderProducts();
      updateCartUI();
    })
    .catch(() => {
      $("resultsInfo").textContent = "No se pudo cargar el catalogo. Recarga la pagina.";
    });

  function renderChips() {
    const counts = {};
    PRODUCTS.forEach((p) => { counts[p.section] = (counts[p.section] || 0) + 1; });
    const chips = SECTION_ORDER.filter((s) => s === "Todo" || counts[s]);

    $("chips").innerHTML = chips.map((s) => {
      const n = s === "Todo" ? PRODUCTS.length : counts[s];
      const label = s === "Todo" ? "Todo" : (SECTION_LABELS[s] || s);
      return '<button class="chip' + (s === activeSection ? " active" : "") + '" data-s="' + esc(s) + '">' +
        esc(label) + '<span class="n">' + n + "</span></button>";
    }).join("");

    $("chips").querySelectorAll(".chip").forEach((b) => {
      b.addEventListener("click", () => {
        activeSection = b.dataset.s;
        renderChips();
        renderProducts();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function visibleProducts() {
    const term = searchTerm.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (activeSection !== "Todo" && p.section !== activeSection) return false;
      if (!term) return true;
      return (p.name + " " + (SECTION_LABELS[p.section] || p.section)).toLowerCase().includes(term);
    });
  }

  function renderProducts() {
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
        '<div class="card-img" data-view="' + esc(p.id) + '" title="Ver producto">' +
          '<img loading="lazy" src="' + esc(p.img) + '" alt="' + esc(p.name) + '">' +
          '<span class="zoom-hint">Ver producto</span>' +
        "</div>" +
        '<div class="card-body">' +
          '<span class="card-section">' + esc(SECTION_LABELS[p.section] || p.section) + "</span>" +
          '<h3 class="card-name">' + esc(p.name) + "</h3>" +
          '<span class="card-price">' + price + "</span>" +
          '<button class="card-add" data-add="' + esc(p.id) + '">Agregar al pedido</button>' +
        "</div></article>";
    }).join("");

    $("grid").querySelectorAll("[data-view]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(el.dataset.view)));
    $("grid").querySelectorAll("[data-add]").forEach((el) =>
      el.addEventListener("click", () => openModal(el.dataset.add)));
  }

  $("searchInput").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderProducts();
  });

  function openLightbox(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    $("lightboxImg").src = p.img;
    $("lightbox").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    $("lightbox").hidden = true;
    document.body.style.overflow = "";
  }

  $("lightboxClose").addEventListener("click", closeLightbox);
  $("lightbox").addEventListener("click", (e) => {
    if (e.target === $("lightbox")) closeLightbox();
  });

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
      $("variantRow").innerHTML = modalProduct.prices.map((price, i) =>
        '<button type="button" class="variant' + (i === 0 ? " active" : "") + '" data-p="' + price + '">' +
        fmt(price) + "</button>"
      ).join("");

      $("variantRow").querySelectorAll(".variant").forEach((b) => {
        b.addEventListener("click", () => {
          modalPrice = Number(b.dataset.p);
          $("variantRow").querySelectorAll(".variant").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
        });
      });
    }

    $("modalBackdrop").hidden = false;
  }

  function closeModal() {
    $("modalBackdrop").hidden = true;
    modalProduct = null;
  }

  $("modalCancel").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", (e) => {
    if (e.target === $("modalBackdrop")) closeModal();
  });
  $("qtyMinus").addEventListener("click", () => {
    $("qtyInput").value = Math.max(1, (Number($("qtyInput").value) || 1) - 1);
  });
  $("qtyPlus").addEventListener("click", () => {
    $("qtyInput").value = (Number($("qtyInput").value) || 1) + 1;
  });

  $("modalAdd").addEventListener("click", () => {
    if (!modalProduct) return;

    const qty = Math.max(1, Number($("qtyInput").value) || 1);
    const note = $("noteInput").value.trim();
    const key = modalProduct.id + "|" + modalPrice + "|" + note.toLowerCase();
    const found = cart.find((c) => c.key === key);

    if (found) found.qty += qty;
    else {
      cart.push({
        key,
        id: modalProduct.id,
        code: modalProduct.code || modalProduct.sku || "",
        name: modalProduct.name,
        img: modalProduct.img,
        officialUrl: modalProduct.officialUrl || "",
        price: modalPrice,
        qty,
        note
      });
    }

    saveCart();
    closeModal();
    updateCartUI();
    showToast("Agregado al pedido");
  });

  function saveCart() {
    localStorage.setItem("bf_cart", JSON.stringify(cart));
  }

  function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

    $("cartCount").textContent = count;
    $("totalAmount").textContent = fmt(total);

    $("drawerItems").innerHTML = cart.map((item, i) =>
      '<div class="item">' +
        '<img src="' + esc(item.img) + '" alt="">' +
        "<div>" +
          '<div class="item-name">' + esc(item.name) + "</div>" +
          (item.note ? '<div class="item-note">' + esc(item.note) + "</div>" : "") +
          '<div class="item-price">' + fmt(item.price) + " c/u</div>" +
        "</div>" +
        '<div class="item-ctrl">' +
          '<div class="item-qty">' +
            '<button data-m="' + i + '" aria-label="Menos">-</button>' +
            "<span>" + item.qty + "</span>" +
            '<button data-p="' + i + '" aria-label="Mas">+</button>' +
          "</div>" +
          '<button class="item-del" data-d="' + i + '">quitar</button>' +
        "</div></div>"
    ).join("");

    $("drawerEmpty").style.display = cart.length ? "none" : "flex";
    $("drawerFoot").style.display = cart.length ? "" : "none";

    $("drawerItems").querySelectorAll("[data-m]").forEach((b) =>
      b.addEventListener("click", () => {
        const item = cart[Number(b.dataset.m)];
        if (item.qty > 1) item.qty -= 1;
        else cart.splice(Number(b.dataset.m), 1);
        saveCart();
        updateCartUI();
      }));
    $("drawerItems").querySelectorAll("[data-p]").forEach((b) =>
      b.addEventListener("click", () => {
        cart[Number(b.dataset.p)].qty += 1;
        saveCart();
        updateCartUI();
      }));
    $("drawerItems").querySelectorAll("[data-d]").forEach((b) =>
      b.addEventListener("click", () => {
        cart.splice(Number(b.dataset.d), 1);
        saveCart();
        updateCartUI();
      }));
  }

  function openDrawer() {
    $("drawer").hidden = false;
    $("drawerBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    $("drawer").hidden = true;
    $("drawerBackdrop").hidden = true;
    document.body.style.overflow = "";
  }

  $("cartBtn").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerBackdrop").addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      closeModal();
      closeDrawer();
    }
  });

  function orderText() {
    const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    const name = $("clientName").value.trim();
    const phone = $("clientPhone").value.trim();
    const delivery = $("clientAddr").value.trim();
    const lines = [];

    lines.push("Pedido - " + CONFIG.nombreTienda);
    lines.push("");
    cart.forEach((item, i) => {
      lines.push((i + 1) + ") " + item.name + (item.note ? " [" + item.note + "]" : ""));
      lines.push("   " + item.qty + " x " + fmt(item.price) + " = " + fmt(item.qty * item.price));
    });
    lines.push("");
    lines.push("TOTAL: " + fmt(total) + " " + CONFIG.moneda);
    if (name || phone || delivery) {
      lines.push("");
      if (name) lines.push("Cliente: " + name);
      if (phone) lines.push("Telefono: " + phone);
      if (delivery) lines.push("Entrega: " + delivery);
    }

    return lines.join("\n");
  }

  async function shareOrder() {
    if (!cart.length) {
      showToast("Tu pedido esta vacio");
      return;
    }

    const text = orderText();
    $("sendOrder").disabled = true;
    $("sendOrder").textContent = "Compartiendo...";

    try {
      window.open("https://wa.me/" + CONFIG.whatsappNumero + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      showToast("Pedido abierto en WhatsApp");
    } catch (e) {
      if (!e || e.name !== "AbortError") {
        copyText(text)
          .then(() => showToast("No se abrio WhatsApp; pedido copiado"))
          .catch(() => showToast("No se pudo compartir"));
      }
    } finally {
      $("sendOrder").disabled = false;
      $("sendOrder").textContent = "Compartir por WhatsApp";
    }
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
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (e) {
        reject(e);
      } finally {
        area.remove();
      }
    });
  }

  $("sendOrder").addEventListener("click", shareOrder);

  let toastTimer = null;
  function showToast(msg) {
    $("toast").textContent = msg;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
  }
})();
