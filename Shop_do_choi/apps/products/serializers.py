from __future__ import annotations

import os

from django.conf import settings
from django.utils.text import slugify
from rest_framework import serializers

from apps.products.models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    backendId = serializers.CharField(source="id", read_only=True)
    category = serializers.SerializerMethodField()
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all(), write_only=True, required=False)
    image = serializers.SerializerMethodField()
    upload_image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    isSale = serializers.BooleanField(source="is_sale", required=False)
    isFlashSale = serializers.BooleanField(source="is_flash_sale", required=False)
    reviews = serializers.IntegerField(source="reviews_count", read_only=True)

    class Meta:
        model = Product
        fields = [
            "backendId",
            "id",
            "name",
            "price",
            "stock",
            "category",
            "category_id",
            "image",
            "upload_image",
            "discount",
            "rating",
            "description",
            "isSale",
            "isFlashSale",
            "tags",
            "reviews",
            "created_at",
        ]

    def get_category(self, obj: Product) -> str:
        return obj.category.name if obj.category_id else ""

    def get_image(self, obj: Product) -> str:
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return ""

    def validate_upload_image(self, image):
        if image.size > settings.MAX_UPLOAD_SIZE:
            raise serializers.ValidationError("Ảnh vượt quá 5MB.")
        ext = os.path.splitext(image.name)[1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise serializers.ValidationError("Chỉ hỗ trợ jpg, jpeg, png, webp.")
        return image

    def create(self, validated_data):
        upload_image = validated_data.pop("upload_image", None)
        category = validated_data.pop("category", None)
        category_name = self.initial_data.get("category")
        if not category and category_name:
            category, _ = Category.objects.get_or_create(name=category_name, defaults={"slug": slugify(category_name)})
        if not category:
            category, _ = Category.objects.get_or_create(name="Khác", defaults={"slug": "khac"})
        product = Product.objects.create(category=category, **validated_data)
        if upload_image:
            product.image = upload_image
            product.save(update_fields=["image"])
        return product

    def update(self, instance, validated_data):
        upload_image = validated_data.pop("upload_image", None)
        category = validated_data.pop("category", None)
        category_name = self.initial_data.get("category")
        if not category and category_name:
            category, _ = Category.objects.get_or_create(name=category_name, defaults={"slug": slugify(category_name)})
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if category:
            instance.category = category
        if upload_image:
            instance.image = upload_image
        instance.save()
        return instance
