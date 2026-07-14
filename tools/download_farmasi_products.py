#!/usr/bin/env python3
"""Download Farmasi product data and images for the local catalog.

This script reads public data from the official consultant site, calls the
same public API endpoints used by the storefront, and stores only normalized
product data plus local WebP product images.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image


SOURCE_URL = "https://www.farmasius.com/kimberlychavezgonzalez"
API_BASE = "https://US-api-gateway-prod.farmasi.com"
SPONSOR_NICKNAME = "kimberlychavezgonzalez"
ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "products"
PRODUCTS_JSON = ROOT / "products.json"
REQUEST_TIMEOUT = 25
PAGE_SIZE = 48

SECTION_ALIASES = {
    "makeup": "Makeup",
    "skin care": "Skincare",
    "skincare": "Skincare",
    "hair care": "Hair Care",
    "self care": "Self Care",
    "men": "Man",
    "man": "Man",
    "fragrances": "Fragancias",
    "fragrance": "Fragancias",
    "nutrition": "Nutrition",
}

SECTION_ORDER = ["Makeup", "Skincare", "Hair Care", "Fragancias", "Self Care", "Man", "Nutrition"]
SECTION_PRIORITY = ["Makeup", "Skincare", "Hair Care", "Fragancias", "Man", "Nutrition", "Self Care"]
ALLOWED_ROOTS = {"Makeup", "Skincare", "Hair Care", "Self Care", "Man", "Nutrition", "Fragancias"}


class FarmasiClient:
    def __init__(self, source_url: str) -> None:
        self.source_url = source_url
        self.initial_data = self._load_initial_data()
        language = self.initial_data["initialLanguageInfo"]
        self.headers = {
            "Accept": "application/json, text/plain, */*",
            "Authorization": "Bearer " + self.initial_data.get("accessToken", ""),
            "X-SponsorNickName": SPONSOR_NICKNAME,
            "X-IsMobile": "false",
            "X-CountryId": language["countryId"],
            "X-LangId": language["languageId"],
            "Accept-Language": language.get("languageCode") or "en-US",
            "X-DeployCommitHash": "a2e592b",
            "envCountryId": "416F5CF7-660D-EB11-801E-0050569C7EB6",
            "Origin": "https://www.farmasius.com",
            "Referer": source_url,
            "User-Agent": "Mozilla/5.0",
        }

    def _load_initial_data(self) -> dict[str, Any]:
        body = read_url(self.source_url).decode("utf-8", "replace")
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', body)
        if not match:
            raise RuntimeError("No se encontro __NEXT_DATA__ en la tienda oficial.")
        data = json.loads(html.unescape(match.group(1)))
        return data["props"]["initialData"]

    def get_json(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        query = "?" + urllib.parse.urlencode(params) if params else ""
        request = urllib.request.Request(API_BASE + path + query, headers=self.headers)
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return json.load(response)


def read_url(url: str, headers: dict[str, str] | None = None) -> bytes:
    request_headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    }
    request_headers.update(headers or {})
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=request_headers)
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {403, 405, 429, 500, 502, 503, 504}:
                raise
        except urllib.error.URLError as exc:
            last_error = exc
        time.sleep(1 + attempt)
    if last_error:
        raise last_error
    raise RuntimeError(f"No se pudo descargar {url}")


def data_root(payload: dict[str, Any]) -> Any:
    return payload.get("Data") if "Data" in payload else payload.get("data", payload)


def safe_slug(value: str, fallback: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value[:80] or fallback


def clean_text(value: Any) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def walk_categories(nodes: list[dict[str, Any]], trail: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    categories: list[dict[str, Any]] = []
    for node in nodes:
        label = node.get("label") or node.get("name") or ""
        crm_id = node.get("crmId")
        current_trail = trail + ((label,) if label else ())
        section = infer_section(current_trail)
        if crm_id and (section in ALLOWED_ROOTS or label == "New Arrivals"):
            categories.append({"label": label, "crmId": crm_id, "trail": current_trail, "section": section})
        for key in ("children", "items", "subCategories", "childs"):
            children = node.get(key)
            if isinstance(children, list):
                categories.extend(walk_categories(children, current_trail))
    return categories


def infer_section(values: tuple[str, ...] | list[str] | None) -> str:
    found = set()
    for value in values or []:
        section = SECTION_ALIASES.get(str(value).strip().lower())
        if section:
            found.add(section)
    for section in SECTION_PRIORITY:
        if section in found:
            return section
    return ""


def product_image_url(product: dict[str, Any]) -> str:
    for item in product.get("images") or product.get("assets") or []:
        if item.get("mediaType") == "image" or item.get("imageUrl") or item.get("uri"):
            return item.get("imageUrl") or item.get("uri") or item.get("thumbUrl") or ""
    return ""


def download_webp(source_url: str, destination: Path) -> bool:
    if not source_url:
        return False
    raw = read_url(source_url)
    with Image.open(BytesIO(raw)) as image:
        image = image.convert("RGB")
        image.thumbnail((900, 900), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=82, method=6)
    return True


def normalize_product(list_item: dict[str, Any], detail: dict[str, Any], section_hint: str) -> dict[str, Any] | None:
    product = {**list_item, **detail}
    code = str(product.get("code") or "").strip()
    name = clean_text(product.get("name"))
    if not code or not name:
        return None

    categories = [clean_text(value) for value in product.get("categories") or [] if clean_text(value)]
    section = (infer_section(categories) if categories else "") or section_hint
    if section not in ALLOWED_ROOTS:
        return None

    slug = safe_slug(product.get("slugName") or name, code.lower())
    filename = safe_slug(f"{code}-{slug}", code.lower()) + ".webp"
    image_url = product_image_url(product)
    local_image = f"assets/products/{filename}"
    official_url = product.get("baseUrl") or f"{SOURCE_URL}/product-detail/{slug}?pid={urllib.parse.quote(code)}"
    description = clean_text(product.get("extraDescription") or product.get("content") or "")
    variants = product.get("variants") or []
    price = float(product.get("price") or product.get("retailPrice") or 0)

    return {
        "id": code,
        "productId": product.get("id"),
        "code": code,
        "sku": code,
        "slug": slug,
        "name": name,
        "section": section,
        "category": categories[0] if categories else section,
        "categories": categories,
        "description": description,
        "prices": [price],
        "price": price,
        "currency": product.get("currencyCode") or "USD",
        "availability": "available" if product.get("stock") else "unavailable",
        "stock": bool(product.get("stock")),
        "variants": variants,
        "brand": product.get("brandName") or "Farmasi",
        "img": local_image,
        "image": local_image,
        "originalImageUrl": image_url,
        "officialUrl": official_url,
    }


def fetch_products(client: FarmasiClient, limit: int | None = None) -> list[dict[str, Any]]:
    menu = data_root(client.get_json("/cms/api/v2/Category/Menu"))
    categories = walk_categories(menu)
    seen_codes: set[str] = set()
    products: list[dict[str, Any]] = []

    for category in categories:
        page_number = 1
        while True:
            payload = client.get_json(
                "/product/api/v2/Product/ListV2",
                {
                    "CategoryId": category["crmId"],
                    "IsListingPage": "true",
                    "PageNumber": page_number,
                    "PageSize": PAGE_SIZE,
                },
            )
            root = data_root(payload)
            page_products = root.get("products") if isinstance(root, dict) else []
            if not page_products:
                break

            for list_item in page_products:
                code = str(list_item.get("code") or "").strip()
                product_id = list_item.get("id")
                if not code or code in seen_codes or not product_id:
                    continue
                try:
                    detail = data_root(client.get_json("/product/api/v2/Product", {"id": product_id}))
                except urllib.error.HTTPError as exc:
                    print(f"Detalle omitido {code}: HTTP {exc.code}", file=sys.stderr)
                    detail = {}
                normalized = normalize_product(list_item, detail, category["section"])
                if not normalized:
                    continue
                seen_codes.add(code)
                products.append(normalized)
                print(f"{len(products):04d} {code} {normalized['name']}")
                if limit and len(products) >= limit:
                    return products
                time.sleep(0.05)

            pagination = root.get("pagination") or {}
            num_pages = int(pagination.get("numPages") or pagination.get("totalPages") or page_number)
            if page_number >= num_pages:
                break
            page_number += 1
            time.sleep(0.1)

    return products


def save_products(products: list[dict[str, Any]]) -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    for product in products:
        destination = ROOT / product["img"]
        try:
            if download_webp(product["originalImageUrl"], destination):
                downloaded += 1
        except Exception as exc:
            print(f"Imagen omitida {product['code']}: {exc}", file=sys.stderr)

    products.sort(key=lambda item: (SECTION_ORDER.index(item["section"]), item["name"]) if item["section"] in SECTION_ORDER else (99, item["name"]))
    PRODUCTS_JSON.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(products)} productos y {downloaded} imagenes en WebP.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Descarga productos oficiales Farmasi para el catalogo local.")
    parser.add_argument("--limit", type=int, default=None, help="Limita la cantidad de productos para pruebas.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    client = FarmasiClient(SOURCE_URL)
    products = fetch_products(client, args.limit)
    if not products:
        print("No se descargaron productos.", file=sys.stderr)
        return 1
    save_products(products)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
