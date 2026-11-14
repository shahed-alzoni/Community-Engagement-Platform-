from django.conf import settings
from django.db import models


class PendingCitizenRegistration(models.Model):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=16)
    password_hash = models.CharField(max_length=128)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    last_sent_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "pending_citizen_registrations"


class PendingEmailChange(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="pending_email_change",
    )
    new_email = models.EmailField()
    original_email = models.EmailField()
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    last_sent_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "pending_email_changes"
