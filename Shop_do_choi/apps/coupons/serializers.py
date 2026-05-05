from rest_framework import serializers

from apps.coupons.models import Coupon


class CouponSerializer(serializers.ModelSerializer):
    discount = serializers.IntegerField(source="discount_percent")
    maxUse = serializers.IntegerField(source="max_use")

    class Meta:
        model = Coupon
        fields = ["id", "code", "discount", "maxUse", "used", "is_active", "expired_at"]
