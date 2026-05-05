from django.conf import settings
from django.db import models

from apps.products.models import Product


class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="reviews", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name="reviews", on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
