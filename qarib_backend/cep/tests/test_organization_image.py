import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cep.models import Organization, OrganizationRepresentativeAssignment, User


PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20


class OrganizationImageTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name='Water')
        self.representative = User.objects.create_user(
            full_name='Water Representative', email='water-image@example.com',
            phone_number='0991122334', password='StrongPass!2026',
            role=User.Role.ORGANIZATION_REPRESENTATIVE,
        )
        OrganizationRepresentativeAssignment.objects.create(
            representative=self.representative, organization=self.organization,
        )
        self.citizen = User.objects.create_user(
            full_name='Citizen', email='citizen-image@example.com',
            phone_number='0991122335', password='StrongPass!2026',
        )
        self.upload_url = reverse('cep:organization-image-upload')
        self.image_url = reverse('cep:organization-image', kwargs={'pk': self.organization.pk})

    def test_representative_uploads_image_and_citizen_sees_it(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(self.representative)
            image = SimpleUploadedFile('logo.png', PNG, content_type='image/png')
            response = self.client.post(self.upload_url, {'image': image}, format='multipart')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.organization.refresh_from_db()
            self.assertTrue(self.organization.image)
            profile = self.client.get(reverse('cep:profile'))
            self.assertEqual(profile.data['organization_image_version'], response.data['image_version'])
            self.client.force_authenticate(self.citizen)
            options = self.client.get(reverse('cep:complaint-organizations'))
            self.assertEqual(options.data[0]['image_version'], response.data['image_version'])
            image_response = self.client.get(self.image_url)
            self.assertEqual(image_response.status_code, status.HTTP_200_OK)
            self.assertEqual(image_response['Content-Type'], 'image/png')
            image_response.close()

    def test_citizen_cannot_upload_and_invalid_image_is_rejected(self):
        self.client.force_authenticate(self.citizen)
        image = SimpleUploadedFile('logo.png', PNG, content_type='image/png')
        self.assertEqual(self.client.post(self.upload_url, {'image': image}, format='multipart').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.representative)
        invalid = SimpleUploadedFile('logo.png', b'not an image', content_type='image/png')
        response = self.client.post(self.upload_url, {'image': invalid}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Organization.objects.get(pk=self.organization.pk).image)
