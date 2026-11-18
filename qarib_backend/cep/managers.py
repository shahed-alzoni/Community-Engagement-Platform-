import re

from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    @staticmethod
    def normalize_phone_number(phone_number: str) -> str:
        """Remove common visual separators while preserving an optional + prefix."""
        return re.sub(r"[\s\-()]", "", phone_number.strip())

    def create_user(
        self,
        email: str,
        phone_number: str,
        full_name: str,
        password: str | None = None,
        **extra_fields,
    ):
        if not email:
            raise ValueError("An email address is required.")
        if not phone_number:
            raise ValueError("A mobile number is required.")
        if not full_name or not full_name.strip():
            raise ValueError("A full name is required.")

        user = self.model(
            email=self.normalize_email(email).lower(),
            phone_number=self.normalize_phone_number(phone_number),
            full_name=full_name.strip(),
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self,
        email: str,
        phone_number: str,
        full_name: str,
        password: str | None = None,
        **extra_fields,
    ):
        from cep.models import User

        if self.filter(system_admin_slot=True).exists():
            raise ValueError("The system already has a System Admin account.")

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", User.Role.SYSTEM_ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        if extra_fields.get("role") != User.Role.SYSTEM_ADMIN:
            raise ValueError("A superuser must have the System Admin role.")

        return self.create_user(
            email=email,
            phone_number=phone_number,
            full_name=full_name,
            password=password,
            **extra_fields,
        )
