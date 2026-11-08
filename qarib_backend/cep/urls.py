from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from cep.views import CitizenRegistrationView, LoginView


app_name = "cep"

urlpatterns = [
    path("auth/register/", CitizenRegistrationView.as_view(), name="citizen-register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
