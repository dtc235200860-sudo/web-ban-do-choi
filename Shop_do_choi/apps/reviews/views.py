from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.products.models import Product
from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer
from toystore.api import api_error, api_ok


class ReviewsView(APIView):
    def get(self, request):
        product_id = request.GET.get("product") or request.GET.get("product_id")
        queryset = Review.objects.select_related("user", "product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return api_ok(ReviewSerializer(queryset, many=True).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return api_error("Vui lòng đăng nhập để đánh giá.", 401)
        product_id = request.data.get("product") or request.data.get("productId")
        product = get_object_or_404(Product, pk=product_id)
        rating = int(request.data.get("rating") or 5)
        comment = str(request.data.get("comment") or "").strip()
        if rating < 1 or rating > 5:
            return api_error("Rating phải từ 1 đến 5.", 400)
        review = Review.objects.create(user=request.user, product=product, rating=rating, comment=comment)
        product.recompute_review_stats()
        return api_ok(ReviewSerializer(review).data, 201)


class ReviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk: str):
        review = get_object_or_404(Review.objects.select_related("product"), pk=pk)
        if not (request.user.is_superuser or getattr(request.user, "role", "") == "admin" or review.user_id == request.user.id):
            return api_error("Bạn không có quyền xóa đánh giá này.", 403)
        product = review.product
        review.delete()
        product.recompute_review_stats()
        return api_ok({"deleted": True})
