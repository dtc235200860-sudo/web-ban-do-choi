from django.db import models
from django.utils import timezone


class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True)
    discount_percent = models.PositiveIntegerField(default=0)
    max_use = models.PositiveIntegerField(default=1)
    used = models.PositiveIntegerField(default=0)
    expired_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    @property
    def is_available(self) -> bool:
        if not self.is_active:
            return False
        if self.expired_at and self.expired_at < timezone.now():
            return False
        return self.used < self.max_use
