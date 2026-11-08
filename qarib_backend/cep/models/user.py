from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models

from cep.managers import UserManager


class User(AbstractUser):
    class Role(models.TextChoices):
        CITIZEN = "citizen", "Citizen"
        ORGANIZATION_REPRESENTATIVE = "representative", "Organization Representative"
        SYSTEM_ADMIN = "system_admin", "System Admin"

    username = None
    first_name = None
    last_name = None

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(
        max_length=16,
        unique=True,
        validators=[
            RegexValidator(
                regex=r"^\d{10}$",
                message="Enter a valid 10-digit mobile number.",
            )
        ],
    )
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.CITIZEN)
    system_admin_slot = models.BooleanField(
        null=True,
        blank=True,
        unique=True,
        editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "phone_number"]

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(role="system_admin", system_admin_slot=True)
                    | (~models.Q(role="system_admin") & models.Q(system_admin_slot__isnull=True))
                ),
                name="valid_system_admin_slot",
            )
        ]

    def save(self, *args, **kwargs):
        self.email = UserManager.normalize_email(self.email).lower()
        self.phone_number = UserManager.normalize_phone_number(self.phone_number)
        self.full_name = self.full_name.strip()
        self.system_admin_slot = self.role == self.Role.SYSTEM_ADMIN or None
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email
