from __future__ import annotations

from django.contrib.auth import login, logout
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView

from apps.accounts.models import PasswordResetToken, User
from apps.accounts.serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)
from toystore.api import api_error, api_ok


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        user = serializer.save()
        login(request, user)
        refresh = RefreshToken.for_user(user)
        return api_ok(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "token": {"refresh": str(refresh), "access": str(refresh.access_token)},
            },
            status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return api_error("Sai email hoặc mật khẩu.", 401)
        if not user.check_password(password):
            return api_error("Sai email hoặc mật khẩu.", 401)
        login(request, user)
        refresh = RefreshToken.for_user(user)
        return api_ok(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "token": {"refresh": str(refresh), "access": str(refresh.access_token)},
            }
        )


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return api_ok({"message": "Đăng xuất thành công."})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        email = serializer.validated_data["email"]
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return api_error("Không tìm thấy tài khoản với email này.", 404)
        reset = PasswordResetToken.create_for_user(user)
        reset_link = f"http://127.0.0.1:8000/reset-password?token={reset.token}"
        return api_ok({"reset_token": reset.token, "reset_link": reset_link})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data, context={})
        if not serializer.is_valid():
            return api_error(serializer.errors, 400)
        reset: PasswordResetToken = serializer.context["reset_token"]
        user = reset.user
        user.set_password(serializer.validated_data["password"])
        user.save()
        reset.is_used = True
        reset.save(update_fields=["is_used"])
        return api_ok({"message": "Đặt lại mật khẩu thành công."})
