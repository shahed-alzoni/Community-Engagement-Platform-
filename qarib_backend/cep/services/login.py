from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken


class LoginService:
    INVALID_CREDENTIALS_MESSAGE = "Unable to log in with the provided credentials."

    @classmethod
    def login(cls, *, email: str, password: str, request=None, required_role=None) -> dict:
        normalized_email = email.strip().lower()
        user = authenticate(request=request, email=normalized_email, password=password)

        if user is None or not user.is_active or (required_role and user.role != required_role):
            raise AuthenticationFailed(cls.INVALID_CREDENTIALS_MESSAGE)

        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.pk,
                "full_name": user.full_name,
                "email": user.email,
                "phone_number": user.phone_number,
                "role": user.role,
            },
        }
