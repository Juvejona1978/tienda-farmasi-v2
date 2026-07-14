// ============================================================
//  CONFIGURACIÓN DE LA TIENDA — edita solo este archivo 💗
//  (los pasos para llenar cada parte están en el README)
// ============================================================

const CONFIG = {
  // --- Identidad ---
  nombreTienda: "Belleza Farmasi",
  eslogan: "Catálogo · Pedidos en línea",
  linkFarmasi: "https://farpaper.farmasi.com/v/e6d9dd06-1462-42b1-ba5e-d87b364931bc",
  moneda: "USD",

  // --- Correos de las VENDEDORAS autorizadas ---
  // Con estos correos ellas crean su cuenta y entran a admin.html
  adminEmail: "CORREO-DE-ELLA@gmail.com",
  adminEmails: [
    "CORREO-DE-ELLA@gmail.com"
    // "OTRA-VENDEDORA@gmail.com"
  ],

  // --- Firebase (README paso 2) ---
  // Copia aquí el bloque "firebaseConfig" que te da Firebase:
  firebase: {
    apiKey: "PEGA-AQUI",
    authDomain: "PEGA-AQUI.firebaseapp.com",
    projectId: "PEGA-AQUI",
    storageBucket: "PEGA-AQUI.appspot.com",
    messagingSenderId: "PEGA-AQUI",
    appId: "PEGA-AQUI"
  },

  // --- EmailJS: aviso por correo de cada pedido (README paso 3) ---
  // Si lo dejas vacío, la tienda funciona igual pero sin aviso por correo.
  emailjs: {
    publicKey: "",    // ej. "aBcDeFg123"
    serviceId: "",    // ej. "service_xxx"
    templateId: ""    // ej. "template_xxx"
  }
};
