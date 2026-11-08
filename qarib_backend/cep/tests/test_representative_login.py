from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import Organization, OrganizationRepresentativeAssignment, User


class RepresentativeLoginApiTests(APITestCase):
    login_url = reverse("cep:representative-login")
    change_url = reverse("cep:representative-change-initial-password")
    temporary_password = "TemporaryPass!2026"
    new_password = "NewStrongPass!2026"

    def setUp(self):
        self.organization = Organization.objects.create(name="Ministry of Water")
        self.representative = User.objects.create_user(
            full_name="Water Representative",
            email="water@example.com",
            phone_number="0991234567",
            password=self.temporary_password,
            role=User.Role.ORGANIZATION_REPRESENTATIVE,
            must_change_password=True,
        )
        OrganizationRepresentativeAssignment.objects.create(
            representative=self.representative,
            organization=self.organization,
        )

    def test_first_login_requires_password_change_without_normal_tokens(self):
        response = self.client.post(self.login_url, self.credentials(), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["password_change_required"])
        self.assertIn("password_change_token", response.data)
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertEqual(response.data["user"]["organization_name"], "Ministry of Water")

    def test_password_change_issues_tokens_and_allows_future_login(self):
        login_response = self.client.post(self.login_url, self.credentials(), format="json")
        change_response = self.client.post(
            self.change_url,
            {
                "token": login_response.data["password_change_token"],
                "new_password": self.new_password,
                "password_confirm": self.new_password,
            },
            format="json",
        )

        self.assertEqual(change_response.status_code, status.HTTP_200_OK)
        self.assertFalse(change_response.data["password_change_required"])
        self.assertIn("access", change_response.data)
        self.assertIn("refresh", change_response.data)
        self.representative.refresh_from_db()
        self.assertFalse(self.representative.must_change_password)
        self.assertTrue(self.representative.check_password(self.new_password))

        next_login = self.client.post(
            self.login_url,
            {"email": self.representative.email, "password": self.new_password},
            format="json",
        )
        self.assertEqual(next_login.status_code, status.HTTP_200_OK)
        self.assertFalse(next_login.data["password_change_required"])
        self.assertIn("access", next_login.data)

    def test_invalid_change_token_is_rejected(self):
        response = self.client.post(
            self.change_url,
            {"token": "invalid", "new_password": self.new_password, "password_confirm": self.new_password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_role_inactive_account_and_unassigned_representative_are_rejected(self):
        citizen = User.objects.create_user(
            full_name="Citizen", email="citizen2@example.com", phone_number="0981234567",
            password=self.temporary_password,
        )
        unassigned = User.objects.create_user(
            full_name="Unassigned", email="unassigned@example.com", phone_number="0971234567",
            password=self.temporary_password, role=User.Role.ORGANIZATION_REPRESENTATIVE,
        )
        self.representative.is_active = False
        self.representative.save(update_fields=["is_active", "updated_at"])

        for email in (citizen.email, unassigned.email, self.representative.email):
            response = self.client.post(
                self.login_url,
                {"email": email, "password": self.temporary_password},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_confirmation_must_match(self):
        login_response = self.client.post(self.login_url, self.credentials(), format="json")
        response = self.client.post(
            self.change_url,
            {"token": login_response.data["password_change_token"], "new_password": self.new_password, "password_confirm": "DifferentPass!2026"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def credentials(self):
        return {"email": self.representative.email, "password": self.temporary_password}
