from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import Organization, OrganizationRepresentativeAssignment, User


class AdminUserManagementApiTests(APITestCase):
    create_url = reverse("cep:admin-user-create")
    list_url = reverse("cep:admin-user-list")
    available_organizations_url = reverse("cep:available-organization-list")
    password = "TemporaryStrongPass!2026"

    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="admin@qarib.local",
            phone_number="0990000001",
            full_name="System Admin",
            password="AdminStrongPass!2026",
        )
        self.client.force_authenticate(self.admin)

    def payload(self, **overrides):
        data = {
            "full_name": "Managed Citizen",
            "email": "managed@example.com",
            "phone_number": "0990000002",
            "password": self.password,
            "role": User.Role.CITIZEN,
        }
        data.update(overrides)
        return data

    def test_system_admin_can_create_citizen_with_hashed_password(self):
        response = self.client.post(self.create_url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="managed@example.com")
        self.assertEqual(user.role, User.Role.CITIZEN)
        self.assertTrue(user.check_password(self.password))
        self.assertFalse(user.must_change_password)
        self.assertFalse(user.organization_assignments.exists())
        self.assertNotIn("password", response.data)

    def test_system_admin_can_create_representative_for_an_organization(self):
        response = self.client.post(
            self.create_url,
            self.payload(
                full_name="Water Ministry Representative",
                email="water@example.com",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name="  Ministry   of Water  ",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="water@example.com")
        organization = Organization.objects.get(normalized_name="ministry of water")
        assignment = user.organization_assignments.get()
        self.assertEqual(organization.name, "Ministry of Water")
        self.assertEqual(assignment.organization, organization)
        self.assertEqual(assignment.active_organization, organization)
        self.assertEqual(assignment.active_representative, user)
        self.assertIsNone(assignment.ended_at)
        self.assertTrue(user.must_change_password)
        self.assertEqual(response.data["organization_name"], "Ministry of Water")

    def test_active_organization_cannot_have_a_second_representative(self):
        first_response = self.client.post(
            self.create_url,
            self.payload(
                email="water-one@example.com",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name="Ministry of Water",
            ),
            format="json",
        )
        second_response = self.client.post(
            self.create_url,
            self.payload(
                email="water-two@example.com",
                phone_number="0990000003",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name=" ministry OF water ",
            ),
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization_name", second_response.data)

    def test_deactivation_releases_organization_for_a_new_representative(self):
        create_response = self.client.post(
            self.create_url,
            self.payload(
                email="electricity-old@example.com",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name="Ministry of Electricity",
            ),
            format="json",
        )
        old_user = User.objects.get(pk=create_response.data["id"])

        deactivate_response = self.client.patch(
            reverse("cep:admin-user-deactivate", kwargs={"user_id": old_user.pk}),
            format="json",
        )
        replacement_response = self.client.post(
            self.create_url,
            self.payload(
                email="electricity-new@example.com",
                phone_number="0990000003",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name="Ministry of Electricity",
            ),
            format="json",
        )

        self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
        old_user.refresh_from_db()
        self.assertFalse(old_user.is_active)
        old_assignment = old_user.organization_assignments.get()
        self.assertIsNotNone(old_assignment.ended_at)
        self.assertIsNone(old_assignment.active_organization)
        self.assertIsNone(old_assignment.active_representative)
        self.assertEqual(replacement_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Organization.objects.count(), 1)
        self.assertEqual(OrganizationRepresentativeAssignment.objects.count(), 2)
        self.assertEqual(
            OrganizationRepresentativeAssignment.objects.filter(ended_at__isnull=True).count(),
            1,
        )

    def test_can_assign_an_available_existing_organization_by_id(self):
        organization = Organization.objects.create(name="Ministry of Transport")

        available = self.client.get(self.available_organizations_url)
        response = self.client.post(
            self.create_url,
            self.payload(
                email="transport@example.com",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_id=organization.pk,
            ),
            format="json",
        )

        self.assertEqual(available.status_code, status.HTTP_200_OK)
        self.assertEqual(available.data[0]["id"], organization.pk)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["organization_name"], "Ministry of Transport")
        self.assertFalse(
            Organization.objects.filter(
                pk=organization.pk,
                active_representative_assignment__isnull=True,
            ).exists()
        )

    def test_admin_can_list_search_and_filter_users_with_summary(self):
        User.objects.create_user(
            full_name="Searchable Citizen",
            email="searchable@example.com",
            phone_number="0990000008",
            password=self.password,
        )
        inactive = User.objects.create_user(
            full_name="Inactive Citizen",
            email="inactive@example.com",
            phone_number="0990000007",
            password=self.password,
        )
        inactive.is_active = False
        inactive.save(update_fields=["is_active", "updated_at"])

        response = self.client.get(
            self.list_url,
            {"search": "Searchable", "role": "citizen", "status": "active"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["email"], "searchable@example.com")
        self.assertEqual(response.data["summary"]["total"], 2)
        self.assertEqual(response.data["summary"]["active"], 1)
        self.assertEqual(response.data["summary"]["citizens"], 2)
        self.assertNotIn("admins", response.data["summary"])
        self.assertFalse(any(user["role"] == User.Role.SYSTEM_ADMIN for user in response.data["results"]))

    def test_admin_can_view_and_edit_allowed_account_fields(self):
        citizen = User.objects.create_user(
            full_name="Original Name",
            email="details@example.com",
            phone_number="0990000006",
            password=self.password,
        )
        url = reverse("cep:admin-user-detail-update", kwargs={"user_id": citizen.pk})

        detail = self.client.get(url)
        updated = self.client.patch(
            url,
            {"full_name": "Updated Name", "phone_number": "0990000005"},
            format="json",
        )

        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["email"], "details@example.com")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["full_name"], "Updated Name")
        self.assertEqual(updated.data["phone_number"], "0990000005")
        self.assertEqual(updated.data["email"], "details@example.com")

    def test_admin_can_change_only_own_email_address(self):
        citizen = User.objects.create_user(
            full_name="Citizen",
            email="protected@example.com",
            phone_number="0990000005",
            password=self.password,
        )
        admin_url = reverse("cep:admin-user-detail-update", kwargs={"user_id": self.admin.pk})
        citizen_url = reverse("cep:admin-user-detail-update", kwargs={"user_id": citizen.pk})

        admin_response = self.client.patch(
            admin_url, {"email": " New.Admin@Qarib.Local "}, format="json"
        )
        citizen_response = self.client.patch(
            citizen_url, {"email": "changed@example.com"}, format="json"
        )

        self.assertEqual(admin_response.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_response.data["email"], "new.admin@qarib.local")
        self.assertEqual(citizen_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", citizen_response.data)
        citizen.refresh_from_db()
        self.assertEqual(citizen.email, "protected@example.com")

    def test_editing_representative_organization_preserves_assignment_history(self):
        created = self.client.post(
            self.create_url,
            self.payload(
                email="change-org@example.com",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name="First Organization",
            ),
            format="json",
        )
        user = User.objects.get(pk=created.data["id"])
        second_organization = Organization.objects.create(name="Second Organization")

        response = self.client.patch(
            reverse("cep:admin-user-detail-update", kwargs={"user_id": user.pk}),
            {"organization_id": second_organization.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["organization_name"], "Second Organization")
        self.assertEqual(len(response.data["assignment_history"]), 2)
        self.assertEqual(user.organization_assignments.filter(ended_at__isnull=True).count(), 1)

    def test_status_toggle_deactivates_and_reactivates_citizen(self):
        citizen = User.objects.create_user(
            full_name="Toggle Citizen",
            email="toggle@example.com",
            phone_number="0990000006",
            password=self.password,
        )
        url = reverse("cep:admin-user-status", kwargs={"user_id": citizen.pk})

        deactivated = self.client.patch(url, {"is_active": False}, format="json")
        reactivated = self.client.patch(url, {"is_active": True}, format="json")

        self.assertEqual(deactivated.status_code, status.HTTP_200_OK)
        self.assertFalse(deactivated.data["is_active"])
        self.assertEqual(reactivated.status_code, status.HTTP_200_OK)
        self.assertTrue(reactivated.data["is_active"])

    def test_reactivation_is_blocked_when_representatives_organization_is_occupied(self):
        original = self.client.post(
            self.create_url,
            self.payload(
                email="old-representative@example.com",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_name="Occupied Organization",
            ),
            format="json",
        )
        old_user = User.objects.get(pk=original.data["id"])
        self.client.patch(
            reverse("cep:admin-user-status", kwargs={"user_id": old_user.pk}),
            {"is_active": False},
            format="json",
        )
        organization = Organization.objects.get(normalized_name="occupied organization")
        self.client.post(
            self.create_url,
            self.payload(
                email="new-representative@example.com",
                phone_number="0990000003",
                role=User.Role.ORGANIZATION_REPRESENTATIVE,
                organization_id=organization.pk,
            ),
            format="json",
        )

        response = self.client.patch(
            reverse("cep:admin-user-status", kwargs={"user_id": old_user.pk}),
            {"is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization_id", response.data)

    def test_representative_requires_organization_and_citizen_cannot_have_one(self):
        missing = self.client.post(
            self.create_url,
            self.payload(role=User.Role.ORGANIZATION_REPRESENTATIVE),
            format="json",
        )
        citizen_with_organization = self.client.post(
            self.create_url,
            self.payload(organization_name="Ministry of Water"),
            format="json",
        )

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization_name", missing.data)
        self.assertEqual(citizen_with_organization.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization_name", citizen_with_organization.data)

    def test_management_api_cannot_create_or_deactivate_system_admin(self):
        create_response = self.client.post(
            self.create_url,
            self.payload(role=User.Role.SYSTEM_ADMIN),
            format="json",
        )
        deactivate_response = self.client.patch(
            reverse("cep:admin-user-deactivate", kwargs={"user_id": self.admin.pk}),
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(deactivate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_non_admins_cannot_manage_users(self):
        citizen = User.objects.create_user(
            full_name="Citizen",
            email="citizen@example.com",
            phone_number="0990000009",
            password="CitizenStrongPass!2026",
        )
        self.client.force_authenticate(citizen)
        forbidden = self.client.post(self.create_url, self.payload(), format="json")
        self.client.force_authenticate(user=None)
        unauthenticated = self.client.post(self.create_url, self.payload(), format="json")

        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(unauthenticated.status_code, status.HTTP_401_UNAUTHORIZED)
