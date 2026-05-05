from django.urls import re_path

from apps.accounts import views


urlpatterns = [
    re_path(r"^register/?$", views.RegisterView.as_view()),
    re_path(r"^login/?$", views.LoginView.as_view()),
    re_path(r"^logout/?$", views.LogoutView.as_view()),
    re_path(r"^forgot-password/?$", views.ForgotPasswordView.as_view()),
    re_path(r"^reset-password/?$", views.ResetPasswordView.as_view()),
]
