from django.urls import re_path

from apps.products import views


urlpatterns = [
    re_path(r"^$", views.ProductsView.as_view()),
    re_path(r"^(?P<pk>[^/]+)/?$", views.ProductDetailView.as_view()),
]
