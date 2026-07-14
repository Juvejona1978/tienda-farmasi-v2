# Belleza Farmasi - Catalogo compartible

Catalogo estatico para GitHub Pages. No usa Firebase, cuentas de usuario,
panel de administracion ni cobros en linea.

## Como funciona

- La clienta explora el catalogo.
- Agrega productos al pedido.
- Puede escribir nombre, telefono y punto de entrega.
- Toca **Compartir por WhatsApp**.
- El pedido se arma como texto para enviarlo por WhatsApp o por el menu nativo
  de compartir del telefono.

## Configuracion

Edita `config.js`:

```js
const CONFIG = {
  nombreTienda: "Belleza Farmasi",
  eslogan: "Catalogo · Pedidos por WhatsApp",
  linkFarmasi: "https://...",
  moneda: "USD"
};
```

## Publicar en GitHub Pages

1. Sube todos los archivos al repositorio.
2. En GitHub: **Settings -> Pages**.
3. Usa rama `main` y carpeta `/ (root)`.
4. La tienda queda en:
   `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`

## Estructura

```text
index.html      -> catalogo para clientas
app.js          -> catalogo, carrito y compartir pedido
styles.css      -> estilos
config.js       -> nombre, enlace Farmasi y moneda
products.json   -> productos del catalogo
pages/          -> imagenes del catalogo
```

## Actualizar catalogo

Cuando cambie la temporada, reemplaza `products.json` y la carpeta `pages/`.
