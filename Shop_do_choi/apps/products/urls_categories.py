from django.urls import re_path

from apps.products import views


urlpatterns = [
    re_path(r"^$", views.CategoriesView.as_view()),
    re_path(r"^(?P<pk>[^/]+)/?$", views.CategoryDetailView.as_view()),
]
