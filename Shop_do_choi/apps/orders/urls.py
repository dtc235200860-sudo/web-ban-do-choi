from django.urls import re_path

from apps.orders import views


urlpatterns = [
    re_path(r"^all/?$", views.AllOrdersView.as_view()),
    re_path(r"^$", views.OrdersView.as_view()),
    re_path(r"^(?P<pk>[^/]+)/?$", views.OrderDetailView.as_view()),
]
