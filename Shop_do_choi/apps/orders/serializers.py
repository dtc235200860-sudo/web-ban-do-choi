from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.orders.models import ORDER_STATUS_LABELS, Order, OrderItem
from apps.products.models import Product


class OrderItemSerializer(serializers.ModelSerializer):
    product_id = serializers.CharField(source="product.id", read_only=True)
    name = serializers.CharField(source="product.name", read_only=True)
    image = serializers.SerializerMethodField()
    backendId = serializers.CharField(source="product.id", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["product_id", "backendId", "name", "image", "quantity", "price"]

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.product.image and hasattr(obj.product.image, "url"):
            return request.build_absolute_uri(obj.product.image.url) if request else obj.product.image.url
        return ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add legacy field name '__backendId' without using a double-underscore
        # class-level attribute (which would be name-mangled).
        if "__backendId" not in self.fields:
            self.fields["__backendId"] = serializers.CharField(source="product.id", read_only=True)


class OrderSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    items = OrderItemSerializer(many=True, read_only=True)
    paymentMethod = serializers.CharField(source="payment_method", read_only=True)
    discount = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "user", "items", "total", "subtotal", "discount_amount", "discount", "status", "paymentMethod", "date", "created_at"]

    def get_user(self, obj: Order) -> str:
        return obj.user.display_name

    def get_status(self, obj: Order) -> str:
        return ORDER_STATUS_LABELS.get(obj.status, obj.get_status_display())

    def get_discount(self, obj: Order) -> int:
        if not obj.subtotal:
            return 0
        return int((Decimal(obj.discount_amount) * Decimal("100")) / Decimal(obj.subtotal)) if obj.discount_amount else 0

    def get_date(self, obj: Order) -> str:
        return obj.date.strftime("%d/%m/%Y")


class CreateOrderSerializer(serializers.Serializer):
    user = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    paymentMethod = serializers.ChoiceField(choices=["cod", "bank", "wallet"])
    discount = serializers.FloatField(required=False, default=0)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Giỏ hàng trống.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        items_payload = validated_data["items"]
        payment_method = validated_data["paymentMethod"]
        discount_percent = Decimal(str(validated_data.get("discount", 0) or 0))
        resolved_items = []
        for entry in items_payload:
            product_id = (entry.get("__backendId") or entry.get("backendId") or entry.get("id") or entry.get("product") or "")
            if not product_id:
                raise serializers.ValidationError("Mã sản phẩm bị thiếu trong payload.")
            try:
                quantity = int(entry.get("quantity") or 1)
            except (TypeError, ValueError):
                raise serializers.ValidationError(f"Số lượng không hợp lệ cho sản phẩm {product_id}.")
            try:
                product = Product.objects.select_for_update().get(pk=product_id)
            except Product.DoesNotExist as exc:
                raise serializers.ValidationError(f"Không tìm thấy sản phẩm với mã {product_id}.") from exc
            if quantity <= 0:
                raise serializers.ValidationError(f"Số lượng không hợp lệ cho sản phẩm {product.name}.")
            if product.stock < quantity:
                raise serializers.ValidationError(f"Sản phẩm {product.name} không đủ tồn kho.")
            resolved_items.append((product, quantity))

        order = Order.objects.create(user=user, payment_method=payment_method, status="pending")
        subtotal = Decimal("0")
        for product, quantity in resolved_items:
            price = product.sale_price
            OrderItem.objects.create(order=order, product=product, quantity=quantity, price=price)
            product.stock -= quantity
            product.save(update_fields=["stock"])
            subtotal += price * quantity

        order.subtotal = subtotal
        order.discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.01")) if discount_percent else Decimal("0")
        order.total = max(subtotal - order.discount_amount + Decimal("30000"), Decimal("0"))
        order.save(update_fields=["subtotal", "discount_amount", "total"])
        return order
