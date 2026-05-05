from django.urls import re_path

from apps.coupons import views


urlpatterns = [
    re_path(r"^apply/?$", views.ApplyCouponView.as_view()),
    re_path(r"^$", views.CouponsView.as_view()),
    re_path(r"^(?P<pk>[^/]+)/?$", views.CouponDetailView.as_view()),
]
