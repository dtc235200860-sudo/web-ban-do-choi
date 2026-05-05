from __future__ import annotations

import random
import shutil
from decimal import Decimal
from pathlib import Path
from typing import Iterable

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify

from apps.coupons.models import Coupon
from apps.orders.models import Order, OrderItem
from apps.products.models import Category, Product, SiteConfig
from apps.reviews.models import Review


User = get_user_model()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

TOY_SOURCE_DIR = settings.BASE_DIR / "ảnh đồ chơi"
BANNER_SOURCE_CANDIDATES = [
    settings.BASE_DIR / "baner quảng cáo",
    Path("D:/baner quảng cáo"),
    settings.BASE_DIR / "banner quảng cáo",
]


PRODUCT_SEED_DATA = [
    {
        "category": "Xếp Hình",
        "name": "Bộ Lắp Ráp Lego Trẻ Em Ninjago Legacy Tàu Bay",
        "image": "xep hinh/bo-lap-rap-lego-tre-em-ninjago-legacy-tau-bay.jpg",
        "price": 249000,
        "stock": 51,
        "discount": 10,
        "rating": Decimal("4.7"),
        "description": "Bộ lắp ráp sáng tạo dành cho bé yêu thích siêu anh hùng và tàu bay.",
        "is_sale": True,
        "is_flash_sale": True,
        "tags": "lego,ninjago,bán chạy",
    },
    {
        "category": "Xếp Hình",
        "name": "Mô Hình Lắp Ráp MGEX Strike Freedom Midnight Coating",
        "image": "xep hinh/Mo-Hinh-Lap-Rap-MGEX-7701-Strike-Freedom-Midnight-Coating.webp",
        "price": 289000,
        "stock": 57,
        "discount": 0,
        "rating": Decimal("4.4"),
        "description": "Mô hình lắp ráp cao cấp với khung xương chi tiết, phù hợp trưng bày.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "mgex,gundam,metal structure",
    },
    {
        "category": "Xe",
        "name": "RC Off Road Truck",
        "image": "xe do choi/RC-Off-road Truck.png",
        "price": 249000,
        "stock": 11,
        "discount": 0,
        "rating": Decimal("4.8"),
        "description": "Xe điều khiển offroad leo dốc khỏe, phù hợp chơi ngoài trời.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "rc,offroad,drift",
    },
    {
        "category": "Xe",
        "name": "Xe Điều Khiển RC",
        "image": "xe do choi/xe-dieu-khien-rc.webp",
        "price": 199000,
        "stock": 35,
        "discount": 12,
        "rating": Decimal("4.3"),
        "description": "Xe điều khiển tốc độ cao chạy ổn định trên mặt phẳng.",
        "is_sale": True,
        "is_flash_sale": False,
        "tags": "xe,điều khiển,rc",
    },
    {
        "category": "Búp Bê",
        "name": "Búp Bê Barbie",
        "image": "gau bong/bup-be-barbie.webp",
        "price": 229000,
        "stock": 30,
        "discount": 0,
        "rating": Decimal("4.4"),
        "description": "Búp bê thời trang với váy hồng và phụ kiện xinh xắn.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "búp bê,barbie",
    },
    {
        "category": "Búp Bê",
        "name": "Mô Hình Búp Bê",
        "image": "gau bong/mo-hinh-bup-be.jpg",
        "price": 209000,
        "stock": 11,
        "discount": 0,
        "rating": Decimal("4.6"),
        "description": "Mô hình búp bê phong cách cá tính, phù hợp trưng bày.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "figure,búp bê",
    },
    {
        "category": "Khoa Học",
        "name": "Khối Rubick",
        "image": "sang tao/khoi-rubick.jpg",
        "price": 159000,
        "stock": 17,
        "discount": 0,
        "rating": Decimal("4.5"),
        "description": "Đồ chơi trí tuệ giúp bé rèn luyện tư duy logic và kiên nhẫn.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "rubick,trí tuệ",
    },
    {
        "category": "Khoa Học",
        "name": "Đồ Chơi Lắp Ghép Kĩ Thuật Bằng Gỗ",
        "image": "sang tao/do-choi-lap-ghep-ki-thuat-bang-go.jpg",
        "price": 269000,
        "stock": 47,
        "discount": 0,
        "rating": Decimal("4.7"),
        "description": "Bộ đồ chơi gỗ phát triển kỹ năng lắp ghép và tư duy kỹ thuật.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "gỗ,kỹ thuật",
    },
    {
        "category": "Khác",
        "name": "Gấu Bông Baby Teddy Trắng",
        "image": "gau bong/gau-bong-Baby-teddy-trang.png",
        "price": 269000,
        "stock": 63,
        "discount": 0,
        "rating": Decimal("4.8"),
        "description": "Gấu bông mềm mại, phù hợp làm quà tặng sinh nhật cho bé.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "gấu bông,teddy",
    },
    {
        "category": "Khác",
        "name": "Gấu Bông MOM Lông Xù",
        "image": "gau bong/gau-bong-MOM-long-xu.webp",
        "price": 219000,
        "stock": 25,
        "discount": 0,
        "rating": Decimal("4.6"),
        "description": "Gấu bông lông xù đáng yêu, bền màu và ít rụng lông.",
        "is_sale": False,
        "is_flash_sale": False,
        "tags": "gấu bông,mom",
    },
]


def _safe_copy_to_media(source: Path, dest_dir: Path) -> str:
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = slugify(source.stem) or source.stem.replace(" ", "-")
    target = dest_dir / f"{filename}{source.suffix.lower()}"
    if not target.exists():
        shutil.copy2(source, target)
    return str(target.relative_to(settings.MEDIA_ROOT)).replace("\\", "/")


def _find_existing_source(relative_path: str) -> Path | None:
    source = TOY_SOURCE_DIR / relative_path
    return source if source.exists() else None


def _iter_banner_sources() -> Iterable[Path]:
    for folder in BANNER_SOURCE_CANDIDATES:
        if folder.exists():
            for item in sorted(folder.rglob("*")):
                if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS:
                    yield item


def ensure_site_config() -> SiteConfig:
    config, _ = SiteConfig.objects.get_or_create(
        key="default",
        defaults={
            "site_name": "ToyLand",
            "hero_title": "Thế Giới Đồ Chơi Kỳ Diệu",
            "hero_subtitle": "Khám phá hàng ngàn sản phẩm đồ chơi chất lượng cao cho trẻ em",
            "site_email": "contact@toystore.com",
            "site_phone": "1900-1234",
            "site_address": "123 Phố Huế, Hoàn Kiếm, Hà Nội",
            "footer_text": "© 2026 ToyLand - Cửa hàng đồ chơi uy tín hàng đầu",
            "categories": ["Xếp Hình", "Xe", "Búp Bê", "Khoa Học", "Khác"],
        },
    )
    return config


def copy_banner_files() -> list[str]:
    copied: list[str] = []
    for source in _iter_banner_sources():
        relative = _safe_copy_to_media(source, settings.MEDIA_ROOT / "banners")
        copied.append(relative)
    return copied


def seed_demo_data(force: bool = False) -> dict[str, int]:
    ensure_site_config()

    if force:
        Review.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        Coupon.objects.all().delete()
        Product.objects.all().delete()
        Category.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()

    categories = {}
    for name in ["Xếp Hình", "Xe", "Búp Bê", "Khoa Học", "Khác"]:
        categories[name], _ = Category.objects.get_or_create(
            slug=slugify(name),
            defaults={"name": name, "description": f"Danh mục {name}"},
        )

    admin, _ = User.objects.get_or_create(
        email="admin@toystore.com",
        defaults={
            "username": "admin",
            "first_name": "Admin",
            "role": "admin",
            "is_staff": True,
            "is_superuser": True,
        },
    )
    admin.set_password("Admin@123")
    admin.role = "admin"
    admin.is_staff = True
    admin.is_superuser = True
    admin.save()

    users = []
    for idx, email in enumerate(["user1@toystore.com", "user2@toystore.com"], start=1):
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "username": f"user{idx}",
                "first_name": f"Người Dùng {idx}",
                "role": "user",
                "phone": f"090000000{idx}",
                "address": f"Số {idx} Đường Mẫu, TP.HCM",
            },
        )
        user.set_password("User@123")
        user.role = "user"
        user.save()
        users.append(user)

    products = []
    for item in PRODUCT_SEED_DATA:
        category = categories[item["category"]]
        image_rel = ""
        source = _find_existing_source(item["image"])
        if source:
            image_rel = _safe_copy_to_media(source, settings.MEDIA_ROOT / "products")
        product, _ = Product.objects.get_or_create(
            slug=slugify(item["name"]),
            defaults={
                "name": item["name"],
                "price": item["price"],
                "stock": item["stock"],
                "category": category,
                "discount": item["discount"],
                "rating": item["rating"],
                "description": item["description"],
                "is_sale": item["is_sale"],
                "is_flash_sale": item["is_flash_sale"],
                "tags": item["tags"],
                "reviews_count": random.randint(80, 240),
            },
        )
        product.name = item["name"]
        product.price = item["price"]
        product.stock = item["stock"]
        product.category = category
        product.discount = item["discount"]
        product.rating = item["rating"]
        product.description = item["description"]
        product.is_sale = item["is_sale"]
        product.is_flash_sale = item["is_flash_sale"]
        product.tags = item["tags"]
        if image_rel:
            product.image = image_rel
        product.save()
        products.append(product)

    for code, percent, max_use in [("WELCOME10", 10, 100), ("SUMMER20", 20, 50), ("FLASH50", 50, 10)]:
        Coupon.objects.update_or_create(
            code=code,
            defaults={
                "discount_percent": percent,
                "max_use": max_use,
                "used": 0,
                "expired_at": timezone.now() + timezone.timedelta(days=90),
                "is_active": True,
            },
        )

    if not Order.objects.exists():
        statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
        for index in range(5):
            customer = users[index % len(users)]
            order = Order.objects.create(
                user=customer,
                status=statuses[index],
                subtotal=0,
                total=0,
                discount_amount=0,
                payment_method="cod" if index % 2 == 0 else "bank",
                date=timezone.localdate() - timezone.timedelta(days=index),
            )
            picked = products[index : index + 2]
            subtotal = Decimal("0")
            for product in picked:
                qty = 1 + (index % 2)
                price = product.sale_price
                OrderItem.objects.create(order=order, product=product, quantity=qty, price=price)
                subtotal += price * qty
            order.subtotal = subtotal
            order.discount_amount = Decimal("30000") if index % 2 == 0 else Decimal("0")
            order.total = max(subtotal - order.discount_amount, Decimal("0"))
            order.save()

    if Review.objects.count() < 10:
        Review.objects.all().delete()
        for idx in range(10):
            user = users[idx % len(users)]
            product = products[idx % len(products)]
            Review.objects.create(
                user=user,
                product=product,
                rating=4 + (idx % 2),
                comment=f"Sản phẩm {product.name} rất phù hợp cho bé, chất lượng ổn định.",
            )
        for product in products:
            product.recompute_review_stats()

    copy_banner_files()

    return {
        "users": User.objects.count(),
        "categories": Category.objects.count(),
        "products": Product.objects.count(),
        "coupons": Coupon.objects.count(),
        "orders": Order.objects.count(),
        "reviews": Review.objects.count(),
    }
