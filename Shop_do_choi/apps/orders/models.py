from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.products.models import Product


ORDER_STATUS_CHOICES = (
    ("pending", "Chờ xác nhận"),
    ("processing", "Đang xử lý"),
    ("shipped", "Đang giao"),
    ("delivered", "Đã giao"),
    ("cancelled", "Hủy"),
)

ORDER_STATUS_LABELS = {
    "pending": "Đang xử lý",
    "processing": "Đang xử lý",
    "shipped": "Đã giao",
    "delivered": "Đã giao",
    "cancelled": "Hủy",
}

PAYMENT_METHOD_CHOICES = (
    ("cod", "Thanh toán khi nhận hàng"),
    ("bank", "Chuyển khoản ngân hàng"),
    ("wallet", "Ví điện tử"),
)


class Order(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="orders", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default="pending")
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default="cod")
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def localized_status(self) -> str:
        return ORDER_STATUS_LABELS.get(self.status, self.get_status_display())

    def recalculate(self) -> None:
        subtotal = Decimal("0")
        for item in self.items.all():
            subtotal += item.price * item.quantity
        self.subtotal = subtotal
        self.total = max(subtotal - self.discount_amount, Decimal("0"))
        self.save(update_fields=["subtotal", "total"])


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name="order_items", on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("order", "product")
