from __future__ import annotations

from django.db.models import Q
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.serializers import CreateOrderSerializer, OrderSerializer
from toystore.api import api_error, api_ok
import traceback


STATUS_INPUT_MAP = {
    "Đang xử lý": "processing",
    "Đã giao": "delivered",
    "Hủy": "cancelled",
    "pending": "pending",
    "processing": "processing",
    "shipped": "shipped",
    "delivered": "delivered",
    "cancelled": "cancelled",
}


class OrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Order.objects.select_related("user").prefetch_related("items__product")
        if request.user.is_superuser or getattr(request.user, "role", "") == "admin":
            username = request.GET.get("user", "").strip()
            if username:
                queryset = queryset.filter(Q(user__first_name=username) | Q(user__username=username))
        else:
            queryset = queryset.filter(user=request.user)
        return api_ok(OrderSerializer(queryset, many=True, context={"request": request}).data)

    @transaction.atomic
    def post(self, request):
        print("[ORDERS_POST] request.data:", request.data)
        serializer = CreateOrderSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        try:
            order = serializer.save()
        except serializers.ValidationError as exc:
            return api_error(exc.detail, 400)
        except Exception as exc:  # unexpected error - return JSON instead of 500
            tb = traceback.format_exc()
            print("[ORDERS_POST_ERROR]", tb)
            return api_error({"error": "Internal server error during order creation", "detail": str(exc)}, 500)
        return api_ok(OrderSerializer(order, context={"request": request}).data, 201)


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk: str) -> Order:
        qs = Order.objects.select_related("user").prefetch_related("items__product")
        order = get_object_or_404(qs, pk=pk)
        if request.user.is_superuser or getattr(request.user, "role", "") == "admin" or order.user_id == request.user.id:
            return order
        raise PermissionError

    def get(self, request, pk: str):
        try:
            order = self.get_object(request, pk)
        except PermissionError:
            return api_error("Bạn không có quyền xem đơn hàng này.", 403)
        return api_ok(OrderSerializer(order, context={"request": request}).data)

    @transaction.atomic
    def put(self, request, pk: str):
        order = get_object_or_404(Order, pk=pk)
        new_status = STATUS_INPUT_MAP.get(str(request.data.get("status") or "").strip())
        if not new_status:
            return api_error("Trạng thái không hợp lệ.", 400)

        is_admin = request.user.is_authenticated and (request.user.is_superuser or getattr(request.user, "role", "") == "admin")
        if is_admin:
            allowed = {
                "pending": {"processing", "cancelled"},
                "processing": {"shipped", "cancelled"},
                "shipped": {"delivered"},
                "delivered": set(),
                "cancelled": set(),
            }
            if new_status not in allowed.get(order.status, set()) and new_status != order.status:
                return api_error("Chuyển trạng thái không hợp lệ.", 400)
        else:
            if order.user_id != request.user.id:
                return api_error("Bạn không có quyền cập nhật đơn hàng này.", 403)
            if not (order.status == "pending" and new_status == "cancelled"):
                return api_error("Người dùng chỉ được hủy đơn khi đơn đang chờ xác nhận.", 400)

        if new_status == "cancelled" and order.status != "cancelled":
            for item in order.items.select_related("product"):
                item.product.stock += item.quantity
                item.product.save(update_fields=["stock"])

        order.status = new_status
        order.save(update_fields=["status"])
        return api_ok(OrderSerializer(order, context={"request": request}).data)


class AllOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền xem tất cả đơn hàng.", 403)
        queryset = Order.objects.select_related("user").prefetch_related("items__product")
        return api_ok(OrderSerializer(queryset, many=True, context={"request": request}).data)
