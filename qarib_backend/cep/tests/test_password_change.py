from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import User


class PasswordChangeTests(APITestCase):
    url = reverse('cep:password-change')
    old_password = 'ExistingStrongPass!2026'
    new_password = 'DifferentStrongPass!2026'

    def setUp(self):
        self.user = User.objects.create_user(
            full_name='Citizen', email='citizen-change@example.com',
            phone_number='0991234567', password=self.old_password,
        )

    def payload(self, **overrides):
        data = {
            'current_password': self.old_password,
            'new_password': self.new_password,
            'password_confirm': self.new_password,
        }
        data.update(overrides)
        return data

    def test_requires_authentication(self):
        response = self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_changes_own_password_for_each_role(self):
        for role in (User.Role.CITIZEN, User.Role.ORGANIZATION_REPRESENTATIVE, User.Role.SYSTEM_ADMIN):
            with self.subTest(role=role):
                self.user.role = role
                self.user.set_password(self.old_password)
                self.user.save(update_fields=['role', 'password'])
                self.client.force_authenticate(self.user)
                response = self.client.post(self.url, self.payload(), format='json')
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.user.refresh_from_db()
                self.assertTrue(self.user.check_password(self.new_password))
                self.assertFalse(self.user.check_password(self.old_password))

    def test_wrong_current_password_is_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(self.url, self.payload(current_password='wrong'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.old_password))

    def test_mismatch_and_reused_password_are_rejected(self):
        self.client.force_authenticate(self.user)
        mismatch = self.client.post(self.url, self.payload(password_confirm='SomethingElse!2026'), format='json')
        reused = self.client.post(self.url, self.payload(new_password=self.old_password, password_confirm=self.old_password), format='json')
        self.assertIn('password_confirm', mismatch.data)
        self.assertIn('new_password', reused.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.old_password))
