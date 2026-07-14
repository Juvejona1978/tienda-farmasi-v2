# 💗 Belleza Farmasi — Tienda con cuentas, pedidos y panel de administración

Tienda estática para GitHub Pages (gratis, sin cobros en línea):

- **Clientes**: crean su cuenta (nombre, teléfono, correo, contraseña), arman
  su pedido desde el catálogo y lo envían. Pueden ver el estado de sus pedidos.
- **Vendedoras**: entran a **`admin.html`** desde teléfono o computadora y ven
  todos los pedidos en tiempo real, cambian el estado (Nuevo → En proceso →
  Entregado), ven la lista de clientes, y pueden compartir cada pedido por
  WhatsApp, correo u otra app del equipo.
- **Correo**: cada pedido nuevo le llega también un aviso a su email.

Todo está diseñado primero para teléfono. 📱

---

## PASO 1 · Configurar la identidad

Abre **`config.js`** y pon:
- `adminEmail`: el correo de la vendedora (con ese entra al panel).
- `adminEmails`: la lista de correos de todas las vendedoras que pueden entrar
  a `admin.html`.
- El resto (nombre de la tienda, eslogan) ya está listo.

## PASO 2 · Crear Firebase (gratis, ~10 min) — guarda cuentas y pedidos

1. Entra a https://console.firebase.google.com con un Gmail → **Crear proyecto**
   (nombre: `tienda-farmasi`, puedes desactivar Analytics).
2. Dentro del proyecto, toca el ícono **`</>`** (Web) → registra la app
   (nombre: `tienda`) → te mostrará un bloque **`firebaseConfig`** con
   apiKey, authDomain, etc. **Copia esos valores dentro de `config.js`**
   (en la parte `firebase: { ... }`).
3. Menú izquierdo → **Authentication** → Comenzar → pestaña
   **Sign-in method** → habilita **Correo electrónico/contraseña** → Guardar.
4. Menú izquierdo → **Firestore Database** → Crear base de datos →
   modo **producción** → ubicación la que sugiera → Habilitar.
5. En Firestore, pestaña **Reglas**: borra lo que hay y pega el contenido
   del archivo **`firestore.rules`** de esta carpeta.
   ⚠️ Dentro de las reglas, cambia `CORREO-DE-ELLA@gmail.com` por los mismos
   correos que pusiste en `config.js` → `adminEmails`. → **Publicar**.
6. Authentication → pestaña **Settings → Dominios autorizados**: cuando ya
   tengas tu enlace de GitHub Pages, agrégalo aquí
   (ej. `tu-usuario.github.io`). `localhost` ya viene incluido para pruebas.

## PASO 3 · Aviso por correo con EmailJS (gratis, opcional, ~5 min)

1. Crea cuenta en https://www.emailjs.com (plan gratuito: 200 correos/mes).
2. **Email Services** → Add New Service → Gmail → conecta el correo de ella.
   Copia el **Service ID**.
3. **Email Templates** → Create New Template. En el asunto pon:
   `Nuevo pedido #{{pedido}} — {{cliente}}`
   Y en el cuerpo pega:

   ```
   Tienes un nuevo pedido 💗

   Pedido: #{{pedido}}
   Cliente: {{cliente}}
   Teléfono: {{telefono}}
   Correo: {{correo}}
   Entrega: {{direccion}}

   {{detalle}}

   TOTAL: {{total}}
   ```

   En "To email" pon el correo de ella. Guarda y copia el **Template ID**.
4. En **Account → General** copia tu **Public Key**.
5. Pega los tres valores en `config.js` → parte `emailjs: { ... }`.

Si dejas EmailJS vacío, la tienda funciona igual: los pedidos siempre quedan
guardados y visibles en el panel; solo no llegará el aviso por correo.

## PASO 4 · Publicar en GitHub Pages

1. Crea un repositorio **público** en https://github.com (ej. `tienda-farmasi`).
2. **Add file → Upload files** → sube TODO el contenido de esta carpeta
   (incluida la carpeta `pages/`). → Commit changes.
3. **Settings → Pages** → Branch: `main`, carpeta `/ (root)` → Save.
4. En 1–2 minutos:
   - Tienda: `https://TU-USUARIO.github.io/tienda-farmasi/`
   - Panel de ella: `https://TU-USUARIO.github.io/tienda-farmasi/admin.html`
5. No olvides el paso 2.6 (agregar `tu-usuario.github.io` a dominios
   autorizados de Firebase).

## 👑 Cómo lo usa ella (desde el teléfono)

1. Abre `.../admin.html`, escribe su correo (el de `config.js`) y una
   contraseña. **La primera vez, esa contraseña queda registrada como suya.**
2. Verá los pedidos al instante, con filtros por estado. Toca un pedido para
   ver el detalle, llamar o escribir al cliente, cambiar el estado, o
   **compartir el pedido** por WhatsApp, correo u otra app. También puede
   copiarlo o descargarlo en `.txt`.
3. En la pestaña **Clientes** ve a todas las personas registradas con sus
   datos de contacto y cuántos pedidos han hecho.
4. Consejo: en el navegador del teléfono → menú → **"Agregar a pantalla de
   inicio"**, y el panel queda como una app. 💅

## 🛍️ Cómo lo usan los clientes

Exploran el catálogo → agregan productos (con tono/código) → al enviar, si no
tienen cuenta la crean ahí mismo (nombre, teléfono, correo, contraseña) → el
pedido queda registrado con número de orden y pueden ver su estado en
"Mi cuenta".

## 📁 Estructura

```
index.html       → tienda para clientes
admin.html       → panel de la vendedora
config.js        → ⚙️ TU CONFIGURACIÓN (edita este)
firestore.rules  → reglas de seguridad para pegar en Firebase
app.js / admin.js / styles.css
products.json    → 108 productos del catálogo
pages/           → 136 páginas del catálogo (imágenes)
```

## 🔄 Catálogo nuevo

Cuando salga la nueva temporada, pídele a Claude procesar el PDF nuevo y
reemplaza `products.json` y `pages/` en GitHub. Lo demás no se toca.
