from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.coupons.models import Coupon
from apps.coupons.serializers import CouponSerializer
from toystore.api import api_error, api_ok


class CouponsView(APIView):
    def get(self, request):
        queryset = Coupon.objects.all()
        if not (request.user.is_authenticated and (request.user.is_superuser or getattr(request.user, "role", "") == "admin")):
            queryset = queryset.filter(is_active=True).filter(Q(expired_at__isnull=True) | Q(expired_at__gt=timezone.now()))
        return api_ok(CouponSerializer(queryset, many=True).data)

    def post(self, request):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền tạo coupon.", 403)
        code = str(request.data.get("code") or "").strip()
        discount = int(request.data.get("discount") or request.data.get("discount_percent") or 0)
        max_use = int(request.data.get("maxUse") or request.data.get("max_use") or 0)
        used = int(request.data.get("used") or 0)
        if not code or discount <= 0 or max_use <= 0:
            return api_error("Dữ liệu coupon không hợp lệ.", 400)
        coupon = Coupon.objects.create(
            code=code,
            discount_percent=discount,
            max_use=max_use,
            used=used,
            is_active=True,
        )
        return api_ok(CouponSerializer(coupon).data, 201)


class CouponDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk: str):
        if not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền xóa coupon.", 403)
        coupon = get_object_or_404(Coupon, pk=pk)
        coupon.delete()
        return api_ok({"deleted": True})


class ApplyCouponView(APIView):
    def post(self, request):
        code = str(request.data.get("code") or "").strip()
        if not code:
            return api_error("Thiếu mã giảm giá.", 400)
        try:
            coupon = Coupon.objects.get(code__iexact=code)
        except Coupon.DoesNotExist:
            return api_error("Mã giảm giá không hợp lệ.", 404)
        if not coupon.is_available:
            return api_error("Mã giảm giá đã hết lượt sử dụng hoặc đã hết hạn.", 409)
        coupon.used += 1
        coupon.save(update_fields=["used"])
        return api_ok({"code": coupon.code, "discount": coupon.discount_percent})
