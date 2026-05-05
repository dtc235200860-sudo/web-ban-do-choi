from django.contrib import admin

from apps.accounts.models import PasswordResetToken, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "username", "role", "is_staff", "is_superuser")
    search_fields = ("email", "username", "first_name")
    list_filter = ("role", "is_staff", "is_superuser")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "token", "expires_at", "is_used", "created_at")
    search_fields = ("user__email", "token")
