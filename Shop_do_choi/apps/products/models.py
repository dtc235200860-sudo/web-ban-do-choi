from __future__ import annotations

from decimal import Decimal

from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=160, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    category = models.ForeignKey(Category, related_name="products", on_delete=models.PROTECT)
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    discount = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    is_sale = models.BooleanField(default=False)
    is_flash_sale = models.BooleanField(default=False)
    tags = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def sale_price(self) -> Decimal:
        if self.discount:
            return (self.price * Decimal(100 - int(self.discount)) / Decimal(100)).quantize(Decimal("0.01"))
        return self.price

    def recompute_review_stats(self) -> None:
        reviews = self.reviews.all()
        total = reviews.count()
        self.reviews_count = total
        if total:
            avg = sum([review.rating for review in reviews]) / total
            self.rating = Decimal(str(round(avg, 1)))
        else:
            self.rating = Decimal("0")
        self.save(update_fields=["reviews_count", "rating"])

    def __str__(self) -> str:
        return self.name


class SiteConfig(models.Model):
    key = models.CharField(max_length=50, unique=True, default="default")
    site_name = models.CharField(max_length=150, default="ToyLand")
    hero_title = models.CharField(max_length=255, default="Thế Giới Đồ Chơi Kỳ Diệu")
    hero_subtitle = models.TextField(default="Khám phá hàng ngàn sản phẩm đồ chơi chất lượng cao cho trẻ em")
    site_email = models.EmailField(blank=True, default="")
    site_phone = models.CharField(max_length=50, blank=True, default="")
    site_address = models.TextField(blank=True, default="")
    footer_text = models.TextField(blank=True, default="")
    categories = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls) -> "SiteConfig":
        obj, _ = cls.objects.get_or_create(key="default")
        return obj

    def to_dict(self) -> dict:
        return {
            "site_name": self.site_name,
            "hero_title": self.hero_title,
            "hero_subtitle": self.hero_subtitle,
            "site_email": self.site_email,
            "site_phone": self.site_phone,
            "site_address": self.site_address,
            "footer_text": self.footer_text,
            "categories": self.categories or [],
        }

    def update_from_dict(self, payload: dict) -> None:
        for field in ["site_name", "hero_title", "hero_subtitle", "site_email", "site_phone", "site_address", "footer_text"]:
            if field in payload:
                setattr(self, field, payload.get(field) or "")
        if "categories" in payload and isinstance(payload["categories"], list):
            self.categories = payload["categories"]
        self.save()
