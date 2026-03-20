from __future__ import annotations

import json
import os
import posixpath
import re
import sqlite3
import sys
import time
import traceback
import urllib.parse
import urllib.request
import unicodedata
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BASE_DIR / "frontend"
DB_PATH = BASE_DIR / "database" / "db.sqlite3"
_EXTERNAL_TOYS_DIR = Path("D:/ảnh đồ chơi")
TOYS_IMAGE_DIR = _EXTERNAL_TOYS_DIR if _EXTERNAL_TOYS_DIR.exists() else (BASE_DIR / "ảnh đồ chơi")
_EXTERNAL_BANNERS_DIR = Path("D:/baner quảng cáo")
_FALLBACK_BANNERS_DIR = BASE_DIR / "baner quảng cáo"
_ALT_FALLBACK_BANNERS_DIR = BASE_DIR / "banner quảng cáo"
BANNERS_DIR = (
    _EXTERNAL_BANNERS_DIR
    if _EXTERNAL_BANNERS_DIR.exists()
    else (_FALLBACK_BANNERS_DIR if _FALLBACK_BANNERS_DIR.exists() else _ALT_FALLBACK_BANNERS_DIR)
)

DEFAULT_SITE_CONFIG: dict[str, Any] = {
    "site_name": "ToyLand",
    "hero_title": "Thế Giới Đồ Chơi Kỳ Diệu",
    "hero_subtitle": "Khám phá hàng ngàn sản phẩm đồ chơi chất lượng cao cho trẻ em",
    "site_email": "contact@toystore.com",
    "site_phone": "1900-1234",
    "site_address": "123 Phố Huế, Hoàn Kiếm, Hà Nội",
    "footer_text": "© 2026 ToyLand - Cửa hàng đồ chơi uy tín hàng đầu",
    "categories": ["Xếp Hình", "Xe", "Búp Bê", "Khoa Học", "Khác"],
}


def json_response(handler: SimpleHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler: SimpleHTTPRequestHandler) -> Any:
    length = int(handler.headers.get("Content-Length") or "0")
    if length <= 0:
        return None
    raw = handler.rfile.read(length)
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def db_connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def db_init() -> None:
    with db_connect() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              data TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS site_config (
              id TEXT PRIMARY KEY,
              data TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS coupons (
              code TEXT PRIMARY KEY,
              discount INTEGER NOT NULL,
              max_use INTEGER NOT NULL,
              used INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              user TEXT NOT NULL,
              data TEXT NOT NULL,
              created_at INTEGER NOT NULL
            );
            """
        )
        # Ensure a sane default config exists; also auto-fix previous test values (e.g. "TestName", "T1", "T2").
        row = conn.execute("SELECT data FROM site_config WHERE id = 'site'").fetchone()
        cfg: dict[str, Any] = {}
        if row:
            try:
                cfg = json.loads(row["data"])
            except Exception:
                cfg = {}

        needs_reset = not cfg
        if str(cfg.get("site_name") or "") in {"TestName", "ToyLand Pro"}:
            needs_reset = True
        if str(cfg.get("hero_title") or "") in {"T1"}:
            needs_reset = True
        if str(cfg.get("hero_subtitle") or "") in {"T2"}:
            needs_reset = True

        if needs_reset:
            conn.execute(
                "INSERT INTO site_config(id, data, updated_at) VALUES('site', ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
                (json.dumps(DEFAULT_SITE_CONFIG, ensure_ascii=False), now_ms()),
            )
        else:
            # Backfill missing keys without overwriting existing values.
            merged = {**DEFAULT_SITE_CONFIG, **cfg}
            if merged != cfg:
                conn.execute(
                    "UPDATE site_config SET data = ?, updated_at = ? WHERE id = 'site'",
                    (json.dumps(merged, ensure_ascii=False), now_ms()),
                )

        # Upgrade built-in sample products to use real images (if older emoji values exist).
        existing_by_id = {p.get("__backendId"): p for p in db_get_products(conn)}
        for sample in SAMPLE_PRODUCTS_FIXED:
            sid = sample.get("__backendId")
            if not sid or sid not in existing_by_id:
                continue
            cur = existing_by_id[sid] or {}
            cur_img = str(cur.get("image") or "")
            if cur_img.startswith("/media/toys/"):
                continue
            cur = dict(cur)
            cur["image"] = sample.get("image")
            if sample.get("category"):
                cur["category"] = sample.get("category")
            if sample.get("name"):
                cur["name"] = sample.get("name")
            db_put_product(conn, cur)

        # Auto-import products from local toy images (idempotent via sourceImage).
        db_import_products_from_images(conn)
        db_upgrade_imported_product_names(conn)
        conn.commit()


def now_ms() -> int:
    return int(time.time() * 1000)


def gen_id(prefix: str) -> str:
    return f"{prefix}_{int(time.time() * 1000)}_{os.urandom(3).hex()}"


def normalize_product(p: dict[str, Any]) -> dict[str, Any]:
    pid = p.get("__backendId") or p.get("id") or gen_id("p")
    p = dict(p)
    p["__backendId"] = pid
    return p


def toy_media_url(rel_posix: str) -> str:
    rel_posix = rel_posix.lstrip("/")
    return "/media/toys/" + urllib.parse.quote(rel_posix)


def banner_media_url(rel_posix: str) -> str:
    rel_posix = rel_posix.lstrip("/")
    return "/media/banners/" + urllib.parse.quote(rel_posix)


SAMPLE_PRODUCTS: list[dict[str, Any]] = [
    {
        "__backendId": "p1",
        "name": "Bộ Xếp Hình Lego Classic",
        "price": 299000,
        "category": "Xếp Hình",
        "image": toy_media_url("xep hinh/bo-lap-rap-lego-tre-em-ninjago-legacy-tau-bay.jpg"),
        "stock": 50,
        "rating": 4.8,
        "reviews": 125,
        "description": "Bộ xếp hình Lego cơ bản với 500 mảnh đa sắc màu",
        "isSale": False,
        "discount": 0,
        "isFlashSale": True,
        "tags": "bán chạy",
    },
    {
        "__backendId": "p2",
        "name": "Xe Điều Khiển Tốc Độ",
        "price": 189000,
        "category": "Xe",
        "image": toy_media_url("xe do choi/RC-Off-road Truck.png"),
        "stock": 30,
        "rating": 4.6,
        "reviews": 98,
        "description": "Xe điều khiển từ xa 4 bánh, tốc độ tối đa 50km/h",
        "isSale": True,
        "discount": 15,
        "isFlashSale": False,
        "tags": "phổ biến",
    },
    {
        "__backendId": "p3",
        "name": "Búp Bê Công Chúa",
        "price": 249000,
        "category": "Búp Bê",
        "image": toy_media_url("gau bong/bup-be-barbie.webp"),
        "stock": 25,
        "rating": 4.9,
        "reviews": 156,
        "description": "Búp bê công chúa với đầy đủ trang phục và phụ kiện",
        "isSale": False,
        "discount": 0,
        "isFlashSale": False,
        "tags": "bán chạy",
    },
    {
        "__backendId": "p4",
        "name": "Bộ Thí Nghiệm Khoa Học",
        "price": 359000,
        "category": "Khoa Học",
        "image": toy_media_url("sang tao/khoi-rubick.jpg"),
        "stock": 20,
        "rating": 4.7,
        "reviews": 87,
        "description": "Bộ thí nghiệm khoa học với 50 bài tập thú vị",
        "isSale": False,
        "discount": 0,
        "isFlashSale": False,
        "tags": "",
    },
    {
        "__backendId": "p5",
        "name": "Xếp Hình 3D Toà Nhà",
        "price": 189000,
        "category": "Xếp Hình",
        "image": toy_media_url("xep hinh/Mo-Hinh-Lap-Rap-Oberon-Mecha.webp"),
        "stock": 40,
        "rating": 4.5,
        "reviews": 64,
        "description": "Xếp hình 3D tòa nhà nổi tiếng thế giới",
        "isSale": True,
        "discount": 10,
        "isFlashSale": False,
        "tags": "phổ biến",
    },
    {
        "__backendId": "p6",
        "name": "Drone Tí Hon",
        "price": 199000,
        "category": "Xe",
        "image": toy_media_url("xe do choi/xe-dieu-khien-rc.webp"),
        "stock": 15,
        "rating": 4.4,
        "reviews": 76,
        "description": "Drone mini điều khiển từ xa có camera HD",
        "isSale": True,
        "discount": 20,
        "isFlashSale": True,
        "tags": "bán chạy",
    },
]

SAMPLE_PRODUCTS_FIXED: list[dict[str, Any]] = [
    {
        "__backendId": "p1",
        "name": "Bộ Xếp Hình Lego Classic",
        "price": 299000,
        "category": "Xếp Hình",
        "image": "🧱",
        "stock": 50,
        "rating": 4.8,
        "reviews": 125,
        "description": "Bộ xếp hình Lego cơ bản với 500 mảnh đa sắc màu",
        "isSale": False,
        "discount": 0,
        "isFlashSale": True,
        "tags": "bán chạy",
    },
    {
        "__backendId": "p2",
        "name": "Xe Điều Khiển Tốc Độ",
        "price": 189000,
        "category": "Xe",
        "image": "🏎️",
        "stock": 30,
        "rating": 4.6,
        "reviews": 98,
        "description": "Xe điều khiển từ xa 4 bánh, tốc độ tối đa 50km/h",
        "isSale": True,
        "discount": 15,
        "isFlashSale": False,
        "tags": "phổ biến",
    },
    {
        "__backendId": "p3",
        "name": "Búp Bê Công Chúa",
        "price": 249000,
        "category": "Búp Bê",
        "image": "👸",
        "stock": 25,
        "rating": 4.9,
        "reviews": 156,
        "description": "Búp bê công chúa với đầy đủ trang phục và phụ kiện",
        "isSale": False,
        "discount": 0,
        "isFlashSale": False,
        "tags": "bán chạy",
    },
    {
        "__backendId": "p4",
        "name": "Bộ Thí Nghiệm Khoa Học",
        "price": 359000,
        "category": "Khoa Học",
        "image": "🔬",
        "stock": 20,
        "rating": 4.7,
        "reviews": 87,
        "description": "Bộ thí nghiệm khoa học với 50 bài tập thú vị",
        "isSale": False,
        "discount": 0,
        "isFlashSale": False,
        "tags": "",
    },
    {
        "__backendId": "p5",
        "name": "Xếp Hình 3D Toà Nhà",
        "price": 189000,
        "category": "Xếp Hình",
        "image": "🏢",
        "stock": 40,
        "rating": 4.5,
        "reviews": 64,
        "description": "Xếp hình 3D tòa nhà nổi tiếng thế giới",
        "isSale": True,
        "discount": 10,
        "isFlashSale": False,
        "tags": "phổ biến",
    },
    {
        "__backendId": "p6",
        "name": "Drone Tí Hon",
        "price": 199000,
        "category": "Xe",
        "image": "🚁",
        "stock": 15,
        "rating": 4.4,
        "reviews": 76,
        "description": "Drone mini điều khiển từ xa có camera HD",
        "isSale": True,
        "discount": 20,
        "isFlashSale": True,
        "tags": "bán chạy",
    },
]

SAMPLE_COUPONS: list[dict[str, Any]] = [
    {"code": "WELCOME10", "discount": 10, "maxUse": 100, "used": 0},
    {"code": "SUMMER20", "discount": 20, "maxUse": 50, "used": 0},
    {"code": "FLASH50", "discount": 50, "maxUse": 10, "used": 0},
]


def db_get_products(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT data FROM products ORDER BY updated_at DESC").fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(json.loads(r["data"]))
    return out


def iter_toy_image_files() -> list[tuple[str, str]]:
    """
    Returns a list of (category_dir, rel_posix_path) for all image files under TOYS_IMAGE_DIR.
    """
    if not TOYS_IMAGE_DIR.exists():
        return []
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    out: list[tuple[str, str]] = []
    for p in TOYS_IMAGE_DIR.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        try:
            rel = p.relative_to(TOYS_IMAGE_DIR)
        except Exception:
            continue
        rel_posix = rel.as_posix()
        cat_dir = rel.parts[0] if rel.parts else ""
        out.append((cat_dir, rel_posix))
    return out


def iter_banner_files() -> list[str]:
    """
    Returns a list of rel_posix_path for all image files under BANNERS_DIR.
    """
    if not BANNERS_DIR.exists():
        return []
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    exclude_names = {
        "urgent toy bargain banner for parents.png",
    }
    out: list[str] = []
    for p in BANNERS_DIR.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        if p.name.lower() in exclude_names:
            continue
        try:
            rel = p.relative_to(BANNERS_DIR)
        except Exception:
            continue
        out.append(rel.as_posix())
    out.sort(key=lambda x: x.lower())
    return out


def strip_diacritics(text: str) -> str:
    text = str(text or "")
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")


def beautify_product_name(stem: str) -> str:
    """
    Convert a filename stem like "gau-bong-baby-teddy-trang" into a nicer Vietnamese name
    with diacritics for common toy terms.
    """
    raw = str(stem or "")
    raw = re.sub(r"[_-]+", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    if not raw:
        return "Sản phẩm đồ chơi"

    s = raw.lower()
    phrase_map: list[tuple[str, str]] = [
        ("bup be", "búp bê"),
        ("gau bong", "gấu bông"),
        ("mo hinh", "mô hình"),
        ("xep hinh", "xếp hình"),
        ("lap rap", "lắp ráp"),
        ("do choi", "đồ chơi"),
        ("dieu khien", "điều khiển"),
        ("toc do", "tốc độ"),
        ("khoa hoc", "khoa học"),
        ("cong chua", "công chúa"),
        ("tre em", "trẻ em"),
        ("ti hon", "tí hon"),
        ("long xu", "lông xù"),
        ("thoi trang", "thời trang"),
    ]
    for k, v in phrase_map:
        s = re.sub(rf"\b{re.escape(k)}\b", v, s)

    token_map: dict[str, str] = {
        "trang": "trắng",
        "den": "đen",
        "hong": "hồng",
        "vang": "vàng",
        "nau": "nâu",
        "tim": "tím",
        "xanh": "xanh",
        "cam": "cam",
    }
    brand_map: dict[str, str] = {
        "rc": "RC",
        "mom": "MOM",
        "lego": "Lego",
        "barbie": "Barbie",
        "stem": "STEM",
    }

    small_words = {"và", "cho", "của", "với", "từ", "đến", "theo", "trong", "ngoài", "là", "ở", "có"}

    words = s.split()
    out_words: list[str] = []
    for i, w in enumerate(words):
        if not w:
            continue
        if w in brand_map:
            out_words.append(brand_map[w])
            continue
        if any(ch.isdigit() for ch in w) or (len(w) <= 5 and w.isupper()):
            out_words.append(w)
            continue
        if w in token_map:
            w = token_map[w]
        if w in small_words and i != 0:
            out_words.append(w)
            continue
        out_words.append(w[:1].upper() + w[1:].lower())

    return " ".join(out_words).strip() or "Sản phẩm đồ chơi"


def db_upgrade_imported_product_names(conn: sqlite3.Connection) -> int:
    """
    Backfill/upgrade names for imported products (those with sourceImage) so Vietnamese terms show diacritics.
    Only updates when the difference is accents/case (same base letters).
    """
    updated = 0
    for p in db_get_products(conn):
        source = str(p.get("sourceImage") or "")
        if not source:
            continue

        fname = Path(source).name
        stem = Path(fname).stem.replace("-", " ").replace("_", " ").strip()
        if not stem:
            continue

        new_name = beautify_product_name(stem)
        old_name = str(p.get("name") or "")
        if not old_name or old_name == new_name:
            continue

        if strip_diacritics(old_name).strip().lower() != strip_diacritics(new_name).strip().lower():
            continue

        p2 = dict(p)
        p2["name"] = new_name
        db_put_product(conn, p2)
        updated += 1

    return updated


def db_import_products_from_images(conn: sqlite3.Connection) -> dict[str, Any]:
    files = iter_toy_image_files()
    if not files:
        return {"imported": 0, "skipped": 0}

    existing = db_get_products(conn)
    existing_sources = {str(p.get("sourceImage") or "") for p in existing if p.get("sourceImage")}

    cat_map = {
        "xep hinh": "Xếp Hình",
        "xe do choi": "Xe",
        "gau bong": "Gấu Bông",
        "sang tao": "Sáng Tạo",
    }
    base_price = {
        "Xếp Hình": 299000,
        "Xe": 189000,
        "Gấu Bông": 249000,
        "Sáng Tạo": 159000,
    }

    imported = 0
    skipped = 0
    for cat_dir, rel_posix in files:
        if rel_posix in existing_sources:
            skipped += 1
            continue

        category = cat_map.get(str(cat_dir).lower(), "Khác")
        fname = Path(rel_posix).name
        stem = Path(fname).stem.replace("-", " ").replace("_", " ").strip()
        name = beautify_product_name(stem)

        h = abs(hash(rel_posix))
        price = base_price.get(category, 199000) + (h % 10) * 10000
        rating = round(4.2 + ((h >> 3) % 8) / 10, 1)
        reviews = int(((h >> 6) % 240) + 10)
        stock = int(((h >> 9) % 60) + 5)

        product = {
            "__backendId": gen_id("img"),
            "name": name,
            "price": int(price),
            "category": category,
            "image": toy_media_url(rel_posix),
            "sourceImage": rel_posix,
            "stock": stock,
            "rating": rating,
            "reviews": reviews,
            "description": f"Sản phẩm thuộc danh mục {category}.",
            "isSale": False,
            "discount": 0,
            "isFlashSale": False,
            "tags": "",
        }
        db_put_product(conn, product)
        imported += 1

    return {"imported": imported, "skipped": skipped}


def db_get_site_config(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT data FROM site_config WHERE id = 'site'").fetchone()
    if not row:
        return {}
    try:
        return json.loads(row["data"])
    except Exception:
        return {}


def db_set_site_config(conn: sqlite3.Connection, cfg: dict[str, Any]) -> dict[str, Any]:
    cfg = dict(cfg or {})
    conn.execute(
        "INSERT INTO site_config(id, data, updated_at) VALUES('site', ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (json.dumps(cfg, ensure_ascii=False), now_ms()),
    )
    return cfg


def db_put_product(conn: sqlite3.Connection, product: dict[str, Any]) -> dict[str, Any]:
    product = normalize_product(product)
    conn.execute(
        "INSERT INTO products(id, data, updated_at) VALUES(?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (product["__backendId"], json.dumps(product, ensure_ascii=False), now_ms()),
    )
    return product


def db_delete_product(conn: sqlite3.Connection, pid: str) -> bool:
    cur = conn.execute("DELETE FROM products WHERE id = ?", (pid,))
    return cur.rowcount > 0


def db_get_coupons(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT code, discount, max_use, used FROM coupons ORDER BY code ASC").fetchall()
    return [{"code": r["code"], "discount": r["discount"], "maxUse": r["max_use"], "used": r["used"]} for r in rows]


def db_upsert_coupon(conn: sqlite3.Connection, coupon: dict[str, Any]) -> dict[str, Any]:
    code = str(coupon.get("code") or "").strip()
    discount = int(coupon.get("discount") or 0)
    max_use = int(coupon.get("maxUse") or coupon.get("max_use") or 0)
    used = int(coupon.get("used") or 0)
    if not code:
        raise ValueError("Missing code")
    if max_use <= 0:
        raise ValueError("Invalid maxUse")
    discount = max(0, min(100, discount))
    used = max(0, used)
    conn.execute(
        "INSERT INTO coupons(code, discount, max_use, used) VALUES(?,?,?,?) "
        "ON CONFLICT(code) DO UPDATE SET discount=excluded.discount, max_use=excluded.max_use",
        (code, discount, max_use, used),
    )
    return {"code": code, "discount": discount, "maxUse": max_use, "used": used}


def gemini_generate_reply(message: str, history: list[dict[str, Any]] | None = None) -> str:
    api_key = str(os.environ.get("GEMINI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY env var")

    model = str(os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash").strip()
    message = str(message or "").strip()
    if not message:
        return "Bạn vui lòng nhập nội dung tin nhắn nhé."

    # Gemini expects roles: "user" / "model"
    contents: list[dict[str, Any]] = []
    for item in (history or [])[-12:]:
        role_in = str(item.get("role") or "").strip().lower()
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        role = "model" if role_in in {"model", "assistant", "bot"} else "user"
        contents.append({"role": role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": message}]})

    payload = {
        "systemInstruction": {
            "parts": [
                {
                    "text": (
                        "Bạn là trợ lý bán hàng ToyLand. Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng.\n"
                        "Nếu người dùng hỏi chung chung, hãy hỏi lại 1-2 câu để làm rõ (độ tuổi bé, ngân sách, loại đồ chơi).\n"
                        "Không trả về HTML, chỉ trả về văn bản."
                    )
                }
            ]
        },
        "contents": contents,
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 512},
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model, safe='')}:generateContent"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8", "X-Goog-Api-Key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        data = json.loads(raw or "{}")

    try:
        return str(data["candidates"][0]["content"]["parts"][0].get("text") or "").strip() or "Mình chưa có câu trả lời phù hợp."
    except Exception:
        # Best-effort fallback for other response shapes
        return str(data.get("text") or data.get("output") or "Mình chưa có câu trả lời phù hợp.").strip()


def db_seed_if_empty(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT COUNT(1) AS c FROM products").fetchone()
    if row and int(row["c"]) > 0:
        return {"seeded": False}

    for p in SAMPLE_PRODUCTS_FIXED:
        db_put_product(conn, p)

    import_result = db_import_products_from_images(conn)
    db_upgrade_imported_product_names(conn)

    for c in SAMPLE_COUPONS:
        conn.execute(
            "INSERT INTO coupons(code, discount, max_use, used) VALUES(?,?,?,?) "
            "ON CONFLICT(code) DO UPDATE SET discount=excluded.discount, max_use=excluded.max_use",
            (c["code"], int(c["discount"]), int(c["maxUse"]), int(c.get("used", 0))),
        )

    return {"seeded": True, **import_result}


def calculate_order_total(items: list[dict[str, Any]], discount_percent: float) -> tuple[int, int, int]:
    subtotal = 0
    for it in items:
        price = int(it.get("price", 0))
        disc = int(it.get("discount", 0) or 0)
        if disc:
            price = int(price * (1 - disc / 100))
        qty = int(it.get("quantity", 1))
        subtotal += price * qty
    discount_amount = int(subtotal * (discount_percent / 100))
    total = subtotal - discount_amount + 30000
    return subtotal, discount_amount, total


class AppHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        path = urllib.parse.urlparse(path).path
        path = posixpath.normpath(path)
        # Serve toy images from TOYS_IMAGE_DIR
        if path.startswith("/media/toys/"):
            sub = path[len("/media/toys/") :]
            sub = urllib.parse.unquote(sub)
            sub = posixpath.normpath(sub).lstrip("/")
            words = [w for w in sub.split("/") if w and w not in (".", "..")]
            local = TOYS_IMAGE_DIR
            for w in words:
                local = local / w
            return str(local)

        # Serve banners from BANNERS_DIR
        if path.startswith("/media/banners/"):
            sub = path[len("/media/banners/") :]
            sub = urllib.parse.unquote(sub)
            sub = posixpath.normpath(sub).lstrip("/")
            words = [w for w in sub.split("/") if w and w not in (".", "..")]
            local = BANNERS_DIR
            for w in words:
                local = local / w
            return str(local)

        # Serve frontend files from FRONTEND_DIR
        words = [w for w in path.split("/") if w]
        local = FRONTEND_DIR
        for w in words:
            if w in (".", ".."):
                continue
            local = local / w
        return str(local)

    def do_GET(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path.startswith("/api/"):
                return self.handle_api_get(parsed)

            # default: serve index.html for root
            if parsed.path in ("/", ""):
                self.path = "/index.html"
            return super().do_GET()
        except Exception as exc:
            traceback.print_exc()
            json_response(self, 500, {"ok": False, "error": str(exc)})

    def do_POST(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            if not parsed.path.startswith("/api/"):
                return json_response(self, 404, {"ok": False, "error": "Not found"})
            return self.handle_api_post(parsed)
        except Exception as exc:
            traceback.print_exc()
            json_response(self, 500, {"ok": False, "error": str(exc)})

    def do_PUT(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            if not parsed.path.startswith("/api/"):
                return json_response(self, 404, {"ok": False, "error": "Not found"})
            return self.handle_api_put(parsed)
        except Exception as exc:
            traceback.print_exc()
            json_response(self, 500, {"ok": False, "error": str(exc)})

    def do_DELETE(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            if not parsed.path.startswith("/api/"):
                return json_response(self, 404, {"ok": False, "error": "Not found"})
            return self.handle_api_delete(parsed)
        except Exception as exc:
            traceback.print_exc()
            json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_api_get(self, parsed: urllib.parse.ParseResult) -> None:
        qs = urllib.parse.parse_qs(parsed.query)
        with db_connect() as conn:
            if parsed.path == "/api/health":
                return json_response(self, 200, {"ok": True})
            if parsed.path == "/api/config":
                return json_response(self, 200, {"ok": True, "data": db_get_site_config(conn)})
            if parsed.path == "/api/banners":
                files = iter_banner_files()
                urls = [banner_media_url(p) for p in files]
                return json_response(self, 200, {"ok": True, "data": urls})
            if parsed.path == "/api/products":
                return json_response(self, 200, {"ok": True, "data": db_get_products(conn)})
            if parsed.path == "/api/coupons":
                return json_response(self, 200, {"ok": True, "data": db_get_coupons(conn)})
            if parsed.path == "/api/orders":
                user = (qs.get("user") or [None])[0]
                if user:
                    rows = conn.execute("SELECT data FROM orders WHERE user = ? ORDER BY created_at DESC", (user,)).fetchall()
                else:
                    rows = conn.execute("SELECT data FROM orders ORDER BY created_at DESC").fetchall()
                return json_response(self, 200, {"ok": True, "data": [json.loads(r["data"]) for r in rows]})

        return json_response(self, 404, {"ok": False, "error": "Not found"})

    def handle_api_post(self, parsed: urllib.parse.ParseResult) -> None:
        body = read_json_body(self) or {}
        with db_connect() as conn:
            if parsed.path == "/api/seed":
                result = db_seed_if_empty(conn)
                conn.commit()
                return json_response(self, 200, {"ok": True, "data": result})

            if parsed.path == "/api/import-images":
                result = db_import_products_from_images(conn)
                db_upgrade_imported_product_names(conn)
                conn.commit()
                return json_response(self, 200, {"ok": True, "data": result})

            if parsed.path == "/api/chat/gemini":
                try:
                    msg = str(body.get("message") or "").strip()
                    history = body.get("history") or []
                    reply = gemini_generate_reply(msg, history if isinstance(history, list) else [])
                    return json_response(self, 200, {"ok": True, "data": {"reply": reply}})
                except Exception as exc:
                    return json_response(self, 500, {"ok": False, "error": str(exc)})

            if parsed.path == "/api/products":
                product = db_put_product(conn, body)
                conn.commit()
                return json_response(self, 201, {"ok": True, "data": product})

            if parsed.path == "/api/coupons":
                try:
                    coupon = db_upsert_coupon(conn, body)
                except ValueError as ve:
                    return json_response(self, 400, {"ok": False, "error": str(ve)})
                conn.commit()
                return json_response(self, 201, {"ok": True, "data": coupon})

            if parsed.path == "/api/coupons/apply":
                code = str(body.get("code") or "").strip()
                if not code:
                    return json_response(self, 400, {"ok": False, "error": "Missing code"})
                row = conn.execute("SELECT code, discount, max_use, used FROM coupons WHERE code = ?", (code,)).fetchone()
                if not row:
                    return json_response(self, 404, {"ok": False, "error": "Invalid coupon"})
                if int(row["used"]) >= int(row["max_use"]):
                    return json_response(self, 409, {"ok": False, "error": "Coupon exhausted"})
                conn.execute("UPDATE coupons SET used = used + 1 WHERE code = ?", (code,))
                conn.commit()
                return json_response(
                    self,
                    200,
                    {"ok": True, "data": {"code": row["code"], "discount": int(row["discount"])}},
                )

            if parsed.path == "/api/orders":
                user = str(body.get("user") or "").strip()
                items = body.get("items") or []
                payment_method = str(body.get("paymentMethod") or "cod")
                discount = float(body.get("discount") or 0)

                if not user or not isinstance(items, list) or len(items) == 0:
                    return json_response(self, 400, {"ok": False, "error": "Missing user/items"})

                # Check stock & reduce stock
                products = {p["__backendId"]: p for p in db_get_products(conn)}
                for it in items:
                    pid = it.get("__backendId")
                    qty = int(it.get("quantity", 1))
                    if pid not in products:
                        return json_response(self, 400, {"ok": False, "error": f"Unknown product {pid}"})
                    if int(products[pid].get("stock", 0)) < qty:
                        return json_response(self, 409, {"ok": False, "error": f"Out of stock: {products[pid].get('name', pid)}"})

                for it in items:
                    pid = it.get("__backendId")
                    qty = int(it.get("quantity", 1))
                    products[pid]["stock"] = int(products[pid].get("stock", 0)) - qty
                    db_put_product(conn, products[pid])

                subtotal, discount_amount, total = calculate_order_total(items, discount)
                order = {
                    "id": "ORD-" + str(int(time.time()))[-8:],
                    "user": user,
                    "items": items,
                    "total": total,
                    "subtotal": subtotal,
                    "discountAmount": discount_amount,
                    "status": "Đang xử lý",
                    "date": time.strftime("%d/%m/%Y"),
                    "paymentMethod": payment_method,
                    "discount": discount,
                }
                oid = order["id"]
                conn.execute(
                    "INSERT INTO orders(id, user, data, created_at) VALUES(?,?,?,?)",
                    (oid, user, json.dumps(order, ensure_ascii=False), now_ms()),
                )
                conn.commit()
                return json_response(self, 201, {"ok": True, "data": order})

        return json_response(self, 404, {"ok": False, "error": "Not found"})

    def handle_api_put(self, parsed: urllib.parse.ParseResult) -> None:
        body = read_json_body(self) or {}
        if parsed.path == "/api/config":
            with db_connect() as conn:
                cfg = db_set_site_config(conn, body)
                conn.commit()
                return json_response(self, 200, {"ok": True, "data": cfg})
        parts = parsed.path.split("/")
        if len(parts) == 4 and parts[2] == "products":
            pid = parts[3]
            body["__backendId"] = pid
            with db_connect() as conn:
                product = db_put_product(conn, body)
                conn.commit()
                return json_response(self, 200, {"ok": True, "data": product})
        return json_response(self, 404, {"ok": False, "error": "Not found"})

    def handle_api_delete(self, parsed: urllib.parse.ParseResult) -> None:
        parts = parsed.path.split("/")
        if len(parts) == 4 and parts[2] == "products":
            pid = parts[3]
            with db_connect() as conn:
                ok = db_delete_product(conn, pid)
                conn.commit()
                if ok:
                    return json_response(self, 200, {"ok": True})
                return json_response(self, 404, {"ok": False, "error": "Not found"})
        return json_response(self, 404, {"ok": False, "error": "Not found"})


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    db_init()
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"ToyLand server running at http://{host}:{port}")
    print(f"Serving frontend from: {FRONTEND_DIR}")
    print(f"Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    # Bind to all interfaces so other devices on the same Wi‑Fi/LAN can access the site.
    # If you only want local access, change this back to "127.0.0.1".
    host = "0.0.0.0"
    port = 8000
    # Usage:
    #   python backend/app.py               -> 0.0.0.0:8000
    #   python backend/app.py 8000          -> 0.0.0.0:8000
    #   python backend/app.py 192.168.1.10 8000 -> 192.168.1.10:8000
    if len(sys.argv) >= 2:
        arg1 = sys.argv[1]
        if arg1.isdigit():
            port = int(arg1)
        else:
            host = arg1
            if len(sys.argv) >= 3 and str(sys.argv[2]).isdigit():
                port = int(sys.argv[2])
    run(host, port)
