from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


class LogoutService:
    @staticmethod
    def logout(*, refresh: str) -> None:
        try:
            RefreshToken(refresh).blacklist()
        except TokenError as error:
            raise ValidationError({"refresh": "Invalid or expired refresh token."}) from error
