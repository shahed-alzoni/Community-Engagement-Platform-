from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from cep.models import User


class AdminLoginApiTests(APITestCase):
    url = reverse("cep:admin-login")
    password = "StrongAdminPass!2026"

    def setUp(self):
        self.admin = User.objects.create_superuser(
            full_name="Qarib System Admin",
            email="admin@qarib.local",
            phone_number="0990000001",
            password=self.password,
        )

    def test_active_system_admin_can_log_in(self):
        response = self.client.post(
            self.url,
            {"email": self.admin.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["role"], User.Role.SYSTEM_ADMIN)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        token = AccessToken(response.data["access"])
        self.assertEqual(token["user_id"], str(self.admin.pk))

    def test_citizen_and_representative_are_rejected_with_generic_error(self):
        users = [
            User.objects.create_user(
                full_name="Citizen",
                email="citizen@example.com",
                phone_number="0990000002",
                password=self.password,
            ),
            User.objects.create_user(
                full_name="Representative",
                email="representative@example.com",
                phone_number="0990000003",
                password=self.password,
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
            ),
        ]

        wrong_password = self.client.post(
            self.url,
            {"email": self.admin.email, "password": "WrongPassword!2026"},
            format="json",
        )
        for user in users:
            response = self.client.post(
                self.url,
                {"email": user.email, "password": self.password},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
            self.assertEqual(response.data["detail"], wrong_password.data["detail"])

    def test_inactive_admin_cannot_log_in(self):
        self.admin.is_active = False
        self.admin.save(update_fields=["is_active", "updated_at", "system_admin_slot"])

        response = self.client.post(
            self.url,
            {"email": self.admin.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_manager_refuses_a_second_superuser(self):
        with self.assertRaisesMessage(ValueError, "already has a System Admin"):
            User.objects.create_superuser(
                full_name="Second Admin",
                email="second-admin@qarib.local",
                phone_number="0990000004",
                password=self.password,
            )

    def test_database_constraint_prevents_a_second_system_admin(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(
                full_name="Second Admin",
                email="second-admin@qarib.local",
                phone_number="0990000004",
                password=self.password,
                role=User.Role.SYSTEM_ADMIN,
            )
