import secrets
import smtplib
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import EmailMessage
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, Throttled, ValidationError

from cep.models import PendingCitizenRegistration, PendingEmailChange, User
from cep.services.registration import CitizenRegistrationService


class EmailVerificationService:
    CODE_LIFETIME = timedelta(minutes=10)
    RESEND_COOLDOWN = timedelta(seconds=60)
    MAX_ATTEMPTS = 5

    @staticmethod
    def _new_code():
        return f"{secrets.randbelow(1_000_000):06d}"

    @staticmethod
    def _send_code(*, email: str, code: str):
        message = EmailMessage(
            subject="Your Qarib verification code",
            body=f"Your Qarib verification code is {code}. It expires in 10 minutes. Do not share this code.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        try:
            message.send(fail_silently=False)
        except (OSError, ConnectionError, smtplib.SMTPException) as error:
            raise APIException("Could not send the verification code. Please try again.") from error

    @classmethod
    def _check_cooldown(cls, pending):
        if pending and timezone.now() - pending.last_sent_at < cls.RESEND_COOLDOWN:
            raise Throttled(wait=60, detail="Wait a minute before requesting another code.")

    @staticmethod
    def _validate_available(*, email: str, phone_number: str | None = None, exclude_user=None):
        users = User.objects.all()
        if exclude_user is not None:
            users = users.exclude(pk=exclude_user.pk)
        if users.filter(email=email).exists():
            raise ValidationError({"email": "This email address is already in use."})
        if phone_number is not None and users.filter(phone_number=phone_number).exists():
            raise ValidationError({"phone_number": "This mobile number is already in use."})

    @classmethod
    def start_registration(cls, *, full_name: str, email: str, phone_number: str, password: str):
        cls._validate_available(email=email, phone_number=phone_number)
        pending = PendingCitizenRegistration.objects.filter(email=email).first()
        cls._check_cooldown(pending)
        code = cls._new_code()
        cls._send_code(email=email, code=code)
        now = timezone.now()
        PendingCitizenRegistration.objects.update_or_create(
            email=email,
            defaults={
                "full_name": full_name,
                "phone_number": phone_number,
                "password_hash": make_password(password),
                "code_hash": make_password(code),
                "expires_at": now + cls.CODE_LIFETIME,
                "last_sent_at": now,
                "attempts": 0,
            },
        )

    @classmethod
    def resend_registration(cls, *, email: str):
        pending = PendingCitizenRegistration.objects.filter(email=email).first()
        if pending is None:
            raise ValidationError({"email": "No pending registration was found. Please register again."})
        cls._check_cooldown(pending)
        code = cls._new_code()
        cls._send_code(email=email, code=code)
        now = timezone.now()
        pending.code_hash = make_password(code)
        pending.expires_at = now + cls.CODE_LIFETIME
        pending.last_sent_at = now
        pending.attempts = 0
        pending.save(update_fields=["code_hash", "expires_at", "last_sent_at", "attempts"])

    @classmethod
    def confirm_registration(cls, *, email: str, code: str) -> User:
        problem = None
        try:
            with transaction.atomic():
                pending = PendingCitizenRegistration.objects.select_for_update().filter(email=email).first()
                if pending is None:
                    problem = "This verification code is invalid or has expired."
                elif pending.expires_at <= timezone.now():
                    pending.delete()
                    problem = "This verification code is invalid or has expired."
                elif not check_password(code, pending.code_hash):
                    pending.attempts += 1
                    if pending.attempts >= cls.MAX_ATTEMPTS:
                        pending.delete()
                        problem = "Too many incorrect attempts. Please register again."
                    else:
                        pending.save(update_fields=["attempts"])
                        problem = "Incorrect verification code."
                else:
                    cls._validate_available(email=pending.email, phone_number=pending.phone_number)
                    user = CitizenRegistrationService.create_verified(pending=pending)
                    pending.delete()
                    return user
        except IntegrityError as error:
            raise ValidationError({"email": "The email or mobile number is already in use."}) from error
        raise ValidationError({"code": problem})

    @classmethod
    def request_email_change(cls, *, user: User, new_email: str):
        normalized = new_email.strip().lower()
        if normalized == user.email:
            raise ValidationError({"email": "Enter a different email address."})
        cls._validate_available(email=normalized, exclude_user=user)
        pending = PendingEmailChange.objects.filter(user=user).first()
        cls._check_cooldown(pending)
        code = cls._new_code()
        cls._send_code(email=normalized, code=code)
        now = timezone.now()
        PendingEmailChange.objects.update_or_create(
            user=user,
            defaults={
                "original_email": user.email,
                "new_email": normalized,
                "code_hash": make_password(code),
                "expires_at": now + cls.CODE_LIFETIME,
                "last_sent_at": now,
                "attempts": 0,
            },
        )

    @classmethod
    def confirm_email_change(cls, *, user: User, code: str) -> str:
        problem = None
        try:
            with transaction.atomic():
                pending = PendingEmailChange.objects.select_for_update().filter(user=user).first()
                if pending is None:
                    problem = "This verification code is invalid or has expired."
                elif pending.expires_at <= timezone.now() or pending.original_email != user.email:
                    pending.delete()
                    problem = "This verification code is invalid or has expired."
                elif not check_password(code, pending.code_hash):
                    pending.attempts += 1
                    if pending.attempts >= cls.MAX_ATTEMPTS:
                        pending.delete()
                        problem = "Too many incorrect attempts. Please request a new code."
                    else:
                        pending.save(update_fields=["attempts"])
                        problem = "Incorrect verification code."
                else:
                    cls._validate_available(email=pending.new_email, exclude_user=user)
                    user.email = pending.new_email
                    user.save(update_fields=["email", "updated_at"])
                    pending.delete()
                    return user.email
        except IntegrityError as error:
            raise ValidationError({"email": "This email address is already in use."}) from error
        raise ValidationError({"code": problem})
