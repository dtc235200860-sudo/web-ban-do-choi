from rest_framework import serializers

from apps.reviews.models import Review


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    productId = serializers.CharField(source="product.id", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "productId", "author", "rating", "comment", "created_at"]

    def get_author(self, obj):
        return obj.user.display_name
