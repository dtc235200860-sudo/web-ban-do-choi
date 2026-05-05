from django.contrib import admin

from apps.coupons.models import Coupon


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_percent", "max_use", "used", "is_active", "expired_at")
    search_fields = ("code",)
