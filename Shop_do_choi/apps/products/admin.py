from django.contrib import admin

from apps.products.models import Category, Product, SiteConfig


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "stock", "rating", "is_sale", "is_flash_sale")
    list_filter = ("category", "is_sale", "is_flash_sale")
    search_fields = ("name", "tags")


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ("key", "site_name", "updated_at")
