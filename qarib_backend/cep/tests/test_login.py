from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from cep.models import User


class LoginApiTests(APITestCase):
    url = reverse("cep:login")
    password = "StrongPass!2026"

    def setUp(self):
        self.user = User.objects.create_user(
            full_name="Test Citizen",
            email="citizen@example.com",
            phone_number="0991234567",
            password=self.password,
        )

    def test_active_citizen_can_log_in(self):
        response = self.client.post(
            self.url,
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.CITIZEN)
        self.assertNotIn("password", response.data)

        access_token = AccessToken(response.data["access"])
        self.assertEqual(access_token["user_id"], str(self.user.pk))

    def test_email_is_case_insensitive(self):
        response = self.client.post(
            self.url,
            {"email": "CITIZEN@EXAMPLE.COM", "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_wrong_password_is_rejected(self):
        response = self.client.post(
            self.url,
            {"email": self.user.email, "password": "WrongPassword!2026"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)

    def test_unknown_email_uses_the_same_generic_error(self):
        wrong_password_response = self.client.post(
            self.url,
            {"email": self.user.email, "password": "WrongPassword!2026"},
            format="json",
        )
        unknown_email_response = self.client.post(
            self.url,
            {"email": "unknown@example.com", "password": self.password},
            format="json",
        )

        self.assertEqual(unknown_email_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            unknown_email_response.data["detail"],
            wrong_password_response.data["detail"],
        )

    def test_inactive_account_cannot_log_in(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active", "updated_at"])

        response = self.client.post(
            self.url,
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)

    def test_successful_login_updates_last_login(self):
        self.assertIsNone(self.user.last_login)

        response = self.client.post(
            self.url,
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_refresh_token_returns_a_new_access_token(self):
        login_response = self.client.post(
            self.url,
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        response = self.client.post(
            reverse("cep:token-refresh"),
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
