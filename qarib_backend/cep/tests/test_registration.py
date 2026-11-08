from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import User


class CitizenRegistrationApiTests(APITestCase):
    url = reverse("cep:citizen-register")

    def valid_payload(self, **overrides):
        payload = {
            "full_name": "Test Citizen",
            "email": "citizen@example.com",
            "phone_number": "0991234567",
            "password": "StrongPass!2026",
            "password_confirm": "StrongPass!2026",
        }
        payload.update(overrides)
        return payload

    def test_registers_a_citizen(self):
        response = self.client.post(self.url, self.valid_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="citizen@example.com")
        self.assertEqual(user.role, User.Role.CITIZEN)
        self.assertTrue(user.check_password("StrongPass!2026"))
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)

    def test_cannot_reuse_email_from_an_inactive_account(self):
        User.objects.create_user(
            full_name="Inactive Citizen",
            email="inactive@example.com",
            phone_number="0991111111",
            password="StrongPass!2026",
            is_active=False,
        )
        response = self.client.post(
            self.url,
            self.valid_payload(email="inactive@example.com"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_cannot_reuse_phone_number(self):
        User.objects.create_user(
            full_name="Existing Citizen",
            email="existing@example.com",
            phone_number="0992222222",
            password="StrongPass!2026",
        )
        response = self.client.post(
            self.url,
            self.valid_payload(phone_number="0992222222"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone_number", response.data)

    def test_phone_number_must_contain_exactly_ten_digits(self):
        for phone_number in ("099123456", "09912345678", "+963991234567"):
            response = self.client.post(
                self.url,
                self.valid_payload(phone_number=phone_number),
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("phone_number", response.data)

    def test_rejects_mismatched_passwords(self):
        response = self.client.post(
            self.url,
            self.valid_payload(password_confirm="DifferentPass!2026"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_client_cannot_assign_a_privileged_role(self):
        response = self.client.post(
            self.url,
            self.valid_payload(role=User.Role.SYSTEM_ADMIN),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="citizen@example.com")
        self.assertEqual(user.role, User.Role.CITIZEN)
