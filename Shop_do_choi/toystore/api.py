from __future__ import annotations

from typing import Any

from rest_framework import permissions, status
from rest_framework.response import Response


def _stringify_error(message: Any) -> str:
    if isinstance(message, dict):
        parts: list[str] = []
        for key, value in message.items():
            parts.append(f"{key}: {_stringify_error(value)}")
        return " | ".join(parts)
    if isinstance(message, (list, tuple, set)):
        return " | ".join(_stringify_error(item) for item in message)
    return str(message)


def api_ok(data: Any = None, status_code: int = status.HTTP_200_OK) -> Response:
    return Response({"ok": True, "data": data}, status=status_code)


def api_error(message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> Response:
    return Response({"ok": False, "error": _stringify_error(message)}, status=status_code)


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or getattr(user, "role", "") == "admin"))


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "role", "") == "admin":
            return True
        return getattr(obj, "user_id", None) == user.id
