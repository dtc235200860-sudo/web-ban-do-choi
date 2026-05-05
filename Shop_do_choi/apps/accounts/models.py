from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = (
        ("guest", "Guest"),
        ("user", "User"),
        ("admin", "Admin"),
    )

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")

    REQUIRED_FIELDS = ["email"]

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = "admin"
        super().save(*args, **kwargs)

    @property
    def display_name(self) -> str:
        return self.get_full_name().strip() or self.first_name or self.username


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reset_tokens")
    token = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def create_for_user(cls, user: User) -> "PasswordResetToken":
        return cls.objects.create(
            user=user,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timedelta(hours=1),
        )

    def is_valid(self) -> bool:
        return (not self.is_used) and self.expires_at >= timezone.now()
