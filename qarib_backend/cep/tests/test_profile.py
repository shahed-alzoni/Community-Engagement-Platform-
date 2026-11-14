import re

from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import Organization, OrganizationRepresentativeAssignment, User


class ProfileApiTests(APITestCase):
    url = reverse("cep:profile")
    password = "StrongPass!2026"

    def setUp(self):
        self.citizen = User.objects.create_user(
            full_name="Citizen User", email="citizen-profile@example.com",
            phone_number="0911111111", password=self.password,
        )

    def test_citizen_can_view_and_update_own_profile(self):
        self.client.force_authenticate(self.citizen)
        detail = self.client.get(self.url)
        updated = self.client.patch(
            self.url,
            {"full_name": "Updated Citizen", "email": "updated@example.com", "phone_number": "0922222222"},
            format="json",
        )

        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["role"], User.Role.CITIZEN)
        self.assertIsNone(detail.data["organization_name"])
        self.assertEqual(updated.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(updated.data["full_name"], "Updated Citizen")
        self.assertEqual(updated.data["email"], "citizen-profile@example.com")
        code = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
        confirmed = self.client.post(reverse("cep:email-change-confirm"), {"code": code}, format="json")
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertEqual(confirmed.data["email"], "updated@example.com")

    def test_representative_sees_organization_but_cannot_update_it_or_role(self):
        organization = Organization.objects.create(name="Ministry of Water")
        representative = User.objects.create_user(
            full_name="Water Representative", email="rep-profile@example.com",
            phone_number="0933333333", password=self.password,
            role=User.Role.ORGANIZATION_REPRESENTATIVE,
        )
        OrganizationRepresentativeAssignment.objects.create(
            representative=representative, organization=organization,
        )
        self.client.force_authenticate(representative)

        detail = self.client.get(self.url)
        updated = self.client.patch(
            self.url,
            {"full_name": "Updated Representative", "role": "citizen", "organization_id": 999},
            format="json",
        )

        self.assertEqual(detail.data["organization_name"], "Ministry of Water")
        self.assertEqual(detail.data["organization_display_name"], "Ministry of Water")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        representative.refresh_from_db()
        self.assertEqual(representative.role, User.Role.ORGANIZATION_REPRESENTATIVE)
        self.assertEqual(representative.active_organization_assignment.organization, organization)

        renamed = self.client.patch(self.url, {"organization_display_name": "Water Services"}, format="json")
        self.assertEqual(renamed.status_code, status.HTTP_200_OK)
        self.assertEqual(renamed.data["organization_display_name"], "Water Services")
        organization.refresh_from_db()
        self.assertEqual(organization.name, "Ministry of Water")
        self.assertEqual(organization.display_name, "Water Services")

        email_request = self.client.patch(self.url, {"email": "new-rep@example.com"}, format="json")
        self.assertEqual(email_request.status_code, status.HTTP_202_ACCEPTED)
        representative.refresh_from_db()
        self.assertEqual(representative.email, "rep-profile@example.com")
        code = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
        confirmed = self.client.post(reverse("cep:email-change-confirm"), {"code": code}, format="json")
        self.assertEqual(confirmed.data["email"], "new-rep@example.com")

    def test_duplicate_email_and_phone_are_rejected(self):
        other = User.objects.create_user(
            full_name="Other", email="other-profile@example.com",
            phone_number="0944444444", password=self.password,
        )
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(
            self.url,
            {"email": other.email, "phone_number": other.phone_number},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertIn("phone_number", response.data)

    def test_citizen_cannot_change_organization_display_name(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(self.url, {"organization_display_name": "Other name"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization_display_name", response.data)

    def test_admin_and_unauthenticated_user_cannot_use_portal_profile(self):
        admin = User.objects.create_superuser(
            full_name="Admin", email="profile-admin@example.com",
            phone_number="0955555555", password=self.password,
        )
        unauthenticated = self.client.get(self.url)
        self.client.force_authenticate(admin)
        forbidden = self.client.get(self.url)

        self.assertEqual(unauthenticated.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
