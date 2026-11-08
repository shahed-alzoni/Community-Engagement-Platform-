import logging
import smtplib

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from cep.models import User


logger = logging.getLogger(__name__)


class PasswordResetService:
    @staticmethod
    def request_reset(*, email: str) -> None:
        user = User.objects.filter(email=email.strip().lower(), is_active=True).first()
        if user is None:
            return

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password/{uid}/{token}"
        context = {"user": user, "reset_url": reset_url, "timeout_minutes": 30}

        message = EmailMultiAlternatives(
            subject="Reset your Qarib password",
            body=render_to_string("emails/password_reset.txt", context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(
            render_to_string("emails/password_reset.html", context),
            "text/html",
        )
        try:
            message.send(fail_silently=False)
        except (OSError, ConnectionError, smtplib.SMTPException):
            logger.exception("Password-reset email delivery failed.")

    @staticmethod
    def get_valid_user(*, uid: str, token: str) -> User | None:
        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
            return None

        if not default_token_generator.check_token(user, token):
            return None
        return user

    @staticmethod
    def reset_password(*, user: User, new_password: str) -> None:
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
