from __future__ import annotations

import os
import socket
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_csv(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def detect_local_ipv4_hosts() -> list[str]:
    hosts: set[str] = set()
    candidates = {"localhost", "127.0.0.1", "0.0.0.0"}

    try:
        hostname = socket.gethostname()
        candidates.add(hostname)
        for ip in socket.gethostbyname_ex(hostname)[2]:
            candidates.add(ip)
    except OSError:
        pass

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            candidates.add(ip)
    except OSError:
        pass

    # Lấy IP đang được dùng để ra ngoài mạng nội bộ, thường là IP Wi-Fi hiện tại.
    probe_sockets = [("8.8.8.8", 80), ("1.1.1.1", 80)]
    for target in probe_sockets:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect(target)
                candidates.add(sock.getsockname()[0])
        except OSError:
            continue

    for value in candidates:
        if not value:
            continue
        if value in {"localhost", "127.0.0.1", "0.0.0.0"}:
            hosts.add(value)
            continue
        parts = value.split(".")
        if len(parts) == 4 and all(part.isdigit() for part in parts):
            hosts.add(value)
    return sorted(hosts)


def build_local_origins(port_values: list[str]) -> list[str]:
    origins: set[str] = set()
    for host in detect_local_ipv4_hosts():
        for port in port_values:
            origins.add(f"http://{host}:{port}")
    return sorted(origins)


SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-toystore-dev-key")
DEBUG = os.getenv("DEBUG", "1") == "1"

STATIC_ALLOWED_HOSTS = env_csv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost,0.0.0.0")
ALLOWED_HOSTS = sorted(set(STATIC_ALLOWED_HOSTS + detect_local_ipv4_hosts()))

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "apps.accounts",
    "apps.products",
    "apps.orders",
    "apps.coupons",
    "apps.reviews",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "toystore.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "frontend"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "toystore.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "database" / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "vi"
TIME_ZONE = "Asia/Ho_Chi_Minh"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
MAX_UPLOAD_SIZE = 5 * 1024 * 1024
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

FRONTEND_DIR = BASE_DIR / "frontend"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

DEFAULT_CORS_ORIGINS = sorted(
    set(
        [
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:5500",
            "http://localhost:5500",
        ]
        + build_local_origins(["8000", "5500"])
    )
)

CORS_ALLOWED_ORIGINS = sorted(
    set(env_csv("DJANGO_CORS_ALLOWED_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)) + DEFAULT_CORS_ORIGINS)
)
CORS_ALLOW_CREDENTIALS = True

DEFAULT_CSRF_TRUSTED_ORIGINS = sorted(
    set(
        [
            "http://127.0.0.1:8000",
            "http://localhost:8000",
        ]
        + build_local_origins(["8000"])
    )
)

CSRF_TRUSTED_ORIGINS = sorted(
    set(env_csv("DJANGO_CSRF_TRUSTED_ORIGINS", ",".join(DEFAULT_CSRF_TRUSTED_ORIGINS)) + DEFAULT_CSRF_TRUSTED_ORIGINS)
)

APPEND_SLASH = False

LOGIN_URL = "/api/auth/login/"
