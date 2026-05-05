from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import PasswordResetToken, User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "name", "phone", "address", "avatar", "role"]

    def get_name(self, obj: User) -> str:
        return obj.display_name

    def get_avatar(self, obj: User) -> str:
        request = self.context.get("request")
        if obj.avatar and hasattr(obj.avatar, "url"):
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return ""


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email đã tồn tại.")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        base_username = validated_data["email"].split("@")[0].strip() or "user"
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"
        user = User.objects.create(
            username=username,
            email=validated_data["email"],
            first_name=validated_data["name"],
            role="user",
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def validate_token(self, value: str) -> str:
        try:
            reset = PasswordResetToken.objects.get(token=value)
        except PasswordResetToken.DoesNotExist as exc:
            raise serializers.ValidationError("Token không hợp lệ.") from exc
        if not reset.is_valid():
            raise serializers.ValidationError("Token đã hết hạn hoặc đã được sử dụng.")
        self.context["reset_token"] = reset
        return value
