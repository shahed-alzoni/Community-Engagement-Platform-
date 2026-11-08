from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from cep.views import (
    CitizenRegistrationView,
    AdminLoginView,
    LoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
)


app_name = "cep"

urlpatterns = [
    path("auth/register/", CitizenRegistrationView.as_view(), name="citizen-register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/admin/login/", AdminLoginView.as_view(), name="admin-login"),
    path(
        "auth/password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
