from __future__ import annotations

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from toystore import views


urlpatterns = [
    path("admin/", admin.site.urls),
    re_path(r"^api/auth/?", include("apps.accounts.urls")),
    re_path(r"^api/products/?", include("apps.products.urls")),
    re_path(r"^api/categories/?", include("apps.products.urls_categories")),
    re_path(r"^api/orders/?", include("apps.orders.urls")),
    re_path(r"^api/reviews/?", include("apps.reviews.urls")),
    re_path(r"^api/coupons/?", include("apps.coupons.urls")),
    re_path(r"^api/config/?$", views.ConfigView.as_view()),
    re_path(r"^api/banners/?$", views.BannersView.as_view()),
    re_path(r"^api/chat/gemini/?$", views.GeminiChatView.as_view()),
    re_path(r"^api/reports/revenue/?$", views.RevenueReportView.as_view()),
    re_path(r"^api/reports/inventory/?$", views.InventoryReportView.as_view()),
    re_path(r"^api/reports/top-products/?$", views.TopProductsReportView.as_view()),
    re_path(r"^api/reports/orders-stats/?$", views.OrdersStatsReportView.as_view()),
    re_path(r"^api/media/toys/?$", views.MediaToysView.as_view()),
    re_path(r"^api/media/banners/?$", views.MediaBannersView.as_view()),
    re_path(r"^api/seed/?$", views.SeedView.as_view()),
    re_path(r"^(?P<asset_type>css|js)/(?P<asset_path>.+)$", views.frontend_asset),
    path("", views.frontend_index, name="home"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
