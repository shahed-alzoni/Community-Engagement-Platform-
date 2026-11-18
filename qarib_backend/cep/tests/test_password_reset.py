from datetime import datetime, timedelta
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import User


@override_settings(PASSWORD_RESET_TIMEOUT=30 * 60)
class PasswordResetTests(APITestCase):
    request_url = reverse("cep:password-reset-request")
    confirm_url = reverse("cep:password-reset-confirm")

    def setUp(self):
        cache.clear()
        mail.outbox.clear()
        self.user = User.objects.create_user(
            email="citizen@example.com",
            phone_number="0900000001",
            full_name="Citizen User",
            password="OldStrongPass!2026",
        )

    def credentials(self, user=None):
        user = user or self.user
        return {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": default_token_generator.make_token(user),
        }

    def test_sends_reset_email_for_every_supported_role(self):
        users = [self.user]
        for index, role in enumerate(
            [User.Role.ORGANIZATION_REPRESENTATIVE, User.Role.SYSTEM_ADMIN],
            start=2,
        ):
            users.append(
                User.objects.create_user(
                    email=f"user{index}@example.com",
                    phone_number=f"090000000{index}",
                    full_name=f"User {index}",
                    password="OldStrongPass!2026",
                    role=role,
                )
            )

        for user in users:
            response = self.client.post(self.request_url, {"email": user.email})
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(len(mail.outbox), 3)
        self.assertEqual({message.to[0] for message in mail.outbox}, {u.email for u in users})
        self.assertTrue(all("/reset-password/" in message.body for message in mail.outbox))

    def test_unknown_and_inactive_accounts_receive_generic_response_without_email(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        inactive_response = self.client.post(self.request_url, {"email": self.user.email})
        unknown_response = self.client.post(self.request_url, {"email": "unknown@example.com"})

        self.assertEqual(inactive_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown_response.status_code, status.HTTP_200_OK)
        self.assertEqual(inactive_response.data, unknown_response.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_representative_cannot_reset_temporary_password_before_first_login(self):
        representative = User.objects.create_user(
            email="first-login-representative@example.com",
            phone_number="0900000009",
            full_name="First Login Representative",
            password="TemporaryPass!2026",
            role=User.Role.ORGANIZATION_REPRESENTATIVE,
            must_change_password=True,
        )

        before_first_login = self.client.post(self.request_url, {"email": representative.email})
        representative.must_change_password = False
        representative.save(update_fields=["must_change_password", "updated_at"])
        after_first_login = self.client.post(self.request_url, {"email": representative.email})

        self.assertEqual(before_first_login.status_code, status.HTTP_200_OK)
        self.assertEqual(after_first_login.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [representative.email])

    def test_request_endpoint_is_rate_limited_after_five_attempts(self):
        for _ in range(5):
            response = self.client.post(self.request_url, {"email": "unknown@example.com"})
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(self.request_url, {"email": "unknown@example.com"})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_valid_token_resets_password_and_cannot_be_reused(self):
        credentials = self.credentials()
        payload = {
            **credentials,
            "new_password": "NewStrongPass!2026",
            "password_confirm": "NewStrongPass!2026",
        }

        response = self.client.post(self.confirm_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass!2026"))

        reused_response = self.client.post(self.confirm_url, payload)
        self.assertEqual(reused_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_token_is_rejected_after_thirty_minutes(self):
        issued_at = datetime(2026, 11, 8, 12, 0, 0)
        with patch.object(default_token_generator, "_now", return_value=issued_at):
            credentials = self.credentials()

        with patch.object(
            default_token_generator,
            "_now",
            return_value=issued_at + timedelta(minutes=31),
        ):
            response = self.client.post(
                self.confirm_url,
                {
                    **credentials,
                    "new_password": "NewStrongPass!2026",
                    "password_confirm": "NewStrongPass!2026",
                },
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_confirmation_and_strength_are_validated(self):
        credentials = self.credentials()
        mismatch = self.client.post(
            self.confirm_url,
            {
                **credentials,
                "new_password": "NewStrongPass!2026",
                "password_confirm": "DifferentPass!2026",
            },
        )
        weak = self.client.post(
            self.confirm_url,
            {
                **credentials,
                "new_password": "12345678",
                "password_confirm": "12345678",
            },
        )

        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", mismatch.data)
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", weak.data)
