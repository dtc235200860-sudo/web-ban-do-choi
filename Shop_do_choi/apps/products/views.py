from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.views import APIView

from apps.products.models import Category, Product
from apps.products.serializers import CategorySerializer, ProductSerializer
from toystore.api import IsAdminRole, api_error, api_ok


class ProductsView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        queryset = Product.objects.select_related("category").all()
        search = request.GET.get("search", "").strip()
        category = request.GET.get("category", "").strip()
        sort = request.GET.get("sort", "").strip()
        min_price = request.GET.get("min_price") or request.GET.get("minPrice")
        max_price = request.GET.get("max_price") or request.GET.get("maxPrice")

        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(tags__icontains=search))
        if category:
            queryset = queryset.filter(category__name__iexact=category)
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        if sort in {"new", "newest"}:
            queryset = queryset.order_by("-created_at")
        elif sort in {"price-low", "price_asc"}:
            queryset = queryset.order_by("price")
        elif sort in {"price-high", "price_desc"}:
            queryset = queryset.order_by("-price")
        elif sort == "rating":
            queryset = queryset.order_by("-rating", "-reviews_count")

        return api_ok(ProductSerializer(queryset, many=True, context={"request": request}).data)

    def post(self, request):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền thêm sản phẩm.", 403)
        serializer = ProductSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        product = serializer.save()
        return api_ok(ProductSerializer(product, context={"request": request}).data, 201)


class ProductDetailView(APIView):
    def get_object(self, pk: str) -> Product:
        return get_object_or_404(Product.objects.select_related("category"), pk=pk)

    def get(self, request, pk: str):
        return api_ok(ProductSerializer(self.get_object(pk), context={"request": request}).data)

    def put(self, request, pk: str):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền cập nhật sản phẩm.", 403)
        instance = self.get_object(pk)
        serializer = ProductSerializer(instance, data=request.data, partial=True, context={"request": request})
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        product = serializer.save()
        return api_ok(ProductSerializer(product, context={"request": request}).data)

    def delete(self, request, pk: str):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền xóa sản phẩm.", 403)
        product = self.get_object(pk)
        product.delete()
        return api_ok({"deleted": True})


class CategoriesView(APIView):
    def get(self, request):
        return api_ok(CategorySerializer(Category.objects.all(), many=True).data)

    def post(self, request):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền tạo danh mục.", 403)
        serializer = CategorySerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        category = serializer.save(slug=slugify(serializer.validated_data["name"]))
        return api_ok(CategorySerializer(category).data, 201)


class CategoryDetailView(APIView):
    def get_object(self, pk: str) -> Category:
        return get_object_or_404(Category, pk=pk)

    def put(self, request, pk: str):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền sửa danh mục.", 403)
        category = self.get_object(pk)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        obj = serializer.save(slug=slugify(serializer.validated_data.get("name", category.name)))
        return api_ok(CategorySerializer(obj).data)

    def delete(self, request, pk: str):
        if not request.user.is_authenticated or not (request.user.is_superuser or getattr(request.user, "role", "") == "admin"):
            return api_error("Bạn không có quyền xóa danh mục.", 403)
        category = self.get_object(pk)
        fallback, _ = Category.objects.get_or_create(name="Khác", defaults={"slug": "khac"})
        Product.objects.filter(category=category).update(category=fallback)
        category.delete()
        return api_ok({"deleted": True})
