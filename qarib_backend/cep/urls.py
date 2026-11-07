from django.urls import path

from cep.views.accounts import CitizenRegistrationView


app_name = "cep"

urlpatterns = [
    path("auth/register/", CitizenRegistrationView.as_view(), name="citizen-register"),
]
