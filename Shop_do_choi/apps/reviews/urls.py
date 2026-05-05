from django.urls import re_path

from apps.reviews import views


urlpatterns = [
    re_path(r"^$", views.ReviewsView.as_view()),
    re_path(r"^(?P<pk>[^/]+)/?$", views.ReviewDetailView.as_view()),
]
