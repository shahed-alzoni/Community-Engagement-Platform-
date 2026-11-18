from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from cep.models import Organization, OrganizationRepresentativeAssignment, User


class LogoutApiTests(APITestCase):
    url = reverse("cep:logout")
    refresh_url = reverse("cep:token-refresh")

    def test_all_account_roles_can_revoke_their_refresh_token(self):
        for index, role in enumerate(User.Role.values):
            with self.subTest(role=role):
                user = User.objects.create_user(
                    full_name=f"User {index}",
                    email=f"user{index}@example.com",
                    phone_number=f"099000000{index}",
                    password="StrongPass!2026",
                    role=role,
                )
                if role == User.Role.ORGANIZATION_REPRESENTATIVE:
                    organization = Organization.objects.create(name="Water Organization")
                    OrganizationRepresentativeAssignment.objects.create(
                        representative=user, organization=organization,
                    )
                refresh = str(RefreshToken.for_user(user))

                response = self.client.post(self.url, {"refresh": refresh}, format="json")
                refreshed = self.client.post(
                    self.refresh_url, {"refresh": refresh}, format="json"
                )

                self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
                self.assertEqual(refreshed.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_or_invalid_refresh_token_is_rejected(self):
        for payload in ({}, {"refresh": "not-a-token"}):
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("refresh", response.data)
