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
assets/products/ -> imagenes WebP locales de productos
tools/download_farmasi_products.py -> extractor reproducible desde Farmasi
```

## Actualizar catalogo

Para regenerar datos e imagenes desde la tienda oficial de Kimberly:

```bash
python3 tools/download_farmasi_products.py
```

El script consulta APIs publicas usadas por Farmasi, guarda imagenes en
`assets/products/` y actualiza `products.json`. No copia el diseño, HTML general
ni scripts de Farmasi.
