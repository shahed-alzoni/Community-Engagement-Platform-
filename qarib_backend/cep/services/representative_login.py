from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import transaction
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from cep.models import User


class RepresentativeLoginService:
    INVALID_CREDENTIALS_MESSAGE = "Unable to log in with the provided credentials."
    INVALID_CHANGE_TOKEN_MESSAGE = "This password change session is invalid or has expired."
    change_token_signer = TimestampSigner(salt="cep.representative.initial-password")

    @classmethod
    def login(cls, *, email: str, password: str, request=None) -> dict:
        user = authenticate(
            request=request,
            email=email.strip().lower(),
            password=password,
        )
        if not cls._is_eligible_representative(user):
            raise AuthenticationFailed(cls.INVALID_CREDENTIALS_MESSAGE)

        if user.must_change_password:
            return {
                "password_change_required": True,
                "password_change_token": cls.change_token_signer.sign(str(user.pk)),
                "user": cls._user_data(user),
            }

        return cls._authenticated_response(user)

    @classmethod
    @transaction.atomic
    def change_initial_password(cls, *, token: str, new_password: str) -> dict:
        try:
            user_id = cls.change_token_signer.unsign(token, max_age=15 * 60)
            user = User.objects.select_for_update().get(pk=user_id)
        except (BadSignature, SignatureExpired, User.DoesNotExist) as error:
            raise AuthenticationFailed(cls.INVALID_CHANGE_TOKEN_MESSAGE) from error

        if not cls._is_eligible_representative(user) or not user.must_change_password:
            raise AuthenticationFailed(cls.INVALID_CHANGE_TOKEN_MESSAGE)

        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password", "updated_at"])
        return cls._authenticated_response(user)

    @staticmethod
    def _is_eligible_representative(user) -> bool:
        return bool(
            user
            and user.is_active
            and user.role == User.Role.ORGANIZATION_REPRESENTATIVE
            and hasattr(user, "active_organization_assignment")
        )

    @classmethod
    def _authenticated_response(cls, user) -> dict:
        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)
        return {
            "password_change_required": False,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": cls._user_data(user),
        }

    @staticmethod
    def _user_data(user) -> dict:
        assignment = user.active_organization_assignment
        return {
            "id": user.pk,
            "full_name": user.full_name,
            "email": user.email,
            "phone_number": user.phone_number,
            "role": user.role,
            "organization_id": assignment.organization_id,
            "organization_name": assignment.organization.name,
        }
