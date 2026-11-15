import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from cep.models import Complaint, Organization, OrganizationRepresentativeAssignment, User


PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20


class CitizenComplaintApiTests(APITestCase):
    url = reverse('cep:citizen-complaints')

    def setUp(self):
        self.citizen = User.objects.create_user(full_name='Citizen', email='complaint@example.com', phone_number='0991234567', password='StrongPass!2026')
        self.other = User.objects.create_user(full_name='Other', email='other-complaint@example.com', phone_number='0991234568', password='StrongPass!2026')
        self.organization = Organization.objects.create(name='Water Organization')
        self.client.force_authenticate(self.citizen)

    def payload(self, **overrides):
        values = {
            'organization': self.organization.pk,
            'title': 'Water leak',
            'description': 'A pipe is leaking beside the school.',
            'latitude': '33.513800',
            'longitude': '36.276500',
            'location_label': 'Damascus',
        }
        values.update(overrides)
        return values

    def test_creates_pending_complaint_with_reference_and_own_tracking(self):
        options = self.client.get(reverse('cep:complaint-organizations'))
        self.assertEqual(options.data, [{'id': self.organization.pk, 'name': 'Water Organization', 'category_id': None, 'image_version': None}])
        response = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertRegex(response.data['reference'], r'^QAR-[A-F0-9]{12}$')
        self.assertEqual(response.data['status'], Complaint.Status.PENDING)
        self.assertEqual(response.data['status_events'][0]['status'], Complaint.Status.PENDING)
        stored = Complaint.objects.get(pk=response.data['id'])
        self.assertEqual(stored.status_events.get().actor, self.citizen)
        self.assertEqual(str(stored.latitude), '33.513800')
        self.assertEqual(str(stored.longitude), '36.276500')
        self.assertEqual(len(self.client.get(self.url).data), 1)
        self.assertEqual(len(self.client.get(self.url, {'reference': response.data['reference']}).data), 1)
        self.assertEqual(self.client.get(reverse('cep:citizen-complaint-detail', kwargs={'pk': response.data['id']})).status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(reverse('cep:citizen-complaint-detail', kwargs={'pk': response.data['id']})).status_code, 404)
        self.assertEqual(len(self.client.get(self.url, {'reference': response.data['reference']}).data), 0)

    def test_accepts_map_location_without_nearby_address(self):
        payload = self.payload()
        payload.pop('location_label')
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['location_label'], '')
        self.assertEqual(str(Complaint.objects.get(pk=response.data['id']).latitude), '33.513800')

    def test_organization_display_name_is_used_for_citizens(self):
        self.organization.display_name = 'Water Services'
        self.organization.save(update_fields=['display_name'])
        options = self.client.get(reverse('cep:complaint-organizations'))
        self.assertEqual(options.data[0]['name'], 'Water Services')
        response = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['organization_name'], 'Water Services')
        self.assertEqual(Complaint.objects.get(pk=response.data['id']).organization.name, 'Water Organization')

    def test_accepts_precise_map_coordinates_with_photo(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            photo = SimpleUploadedFile('evidence.png', PNG, content_type='image/png')
            response = self.client.post(
                self.url,
                self.payload(latitude='33.468923456789', longitude='36.302421234567', photos=[photo]),
                format='multipart',
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            complaint = Complaint.objects.get(pk=response.data['id'])
            self.assertEqual(str(complaint.latitude), '33.468923')
            self.assertEqual(str(complaint.longitude), '36.302421')
            self.assertEqual(complaint.photos.count(), 1)

    def test_assigns_active_representative_for_selected_organization(self):
        representative = User.objects.create_user(full_name='Rep', email='rep-complaint@example.com', phone_number='0991234569', password='StrongPass!2026', role=User.Role.ORGANIZATION_REPRESENTATIVE)
        OrganizationRepresentativeAssignment.objects.create(representative=representative, organization=self.organization)
        response = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(response.data['status'], Complaint.Status.PENDING)
        self.assertEqual(Complaint.objects.get(pk=response.data['id']).assigned_representative, representative)
        self.client.force_authenticate(representative)
        self.assertEqual(self.client.post(self.url, self.payload(), format='multipart').status_code, status.HTTP_403_FORBIDDEN)

    def test_rejects_invalid_location_and_too_many_photos(self):
        invalid = self.client.post(self.url, self.payload(latitude='91'), format='multipart')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('latitude', invalid.data)
        photos = [SimpleUploadedFile(f'photo-{i}.png', PNG, content_type='image/png') for i in range(4)]
        too_many = self.client.post(self.url, self.payload(photos=photos), format='multipart')
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photos', too_many.data)
        self.assertFalse(Complaint.objects.exists())

        unknown_org = self.client.post(self.url, self.payload(organization=99999), format='multipart')
        self.assertEqual(unknown_org.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization', unknown_org.data)

    def test_photo_validation_and_private_access(self):
        fake = SimpleUploadedFile('fake.png', b'<script>bad</script>', content_type='image/png')
        invalid = self.client.post(self.url, self.payload(photos=[fake]), format='multipart')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('photos', invalid.data)
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            valid = SimpleUploadedFile('evidence.png', PNG, content_type='image/png')
            created = self.client.post(self.url, self.payload(photos=[valid]), format='multipart')
            self.assertEqual(created.status_code, status.HTTP_201_CREATED)
            self.assertEqual(len(created.data['photos']), 1)
            photo_url = reverse('cep:citizen-complaint-photo', kwargs={'pk': created.data['id'], 'photo_id': created.data['photos'][0]['id']})
            owner_response = self.client.get(photo_url)
            self.assertEqual(owner_response.status_code, status.HTTP_200_OK)
            b''.join(owner_response.streaming_content)
            self.client.force_authenticate(self.other)
            self.assertEqual(self.client.get(photo_url).status_code, status.HTTP_404_NOT_FOUND)

    def test_accepts_three_photos_and_none(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            without_photos = self.client.post(self.url, self.payload(), format='multipart')
            self.assertEqual(without_photos.status_code, status.HTTP_201_CREATED)
            self.assertEqual(without_photos.data['photos'], [])

            photos = [SimpleUploadedFile(f'photo-{index}.png', PNG, content_type='image/png') for index in range(3)]
            with_photos = self.client.post(self.url, self.payload(photos=photos), format='multipart')
            self.assertEqual(with_photos.status_code, status.HTTP_201_CREATED)
            self.assertEqual(len(with_photos.data['photos']), 3)
            self.assertEqual(Complaint.objects.get(pk=with_photos.data['id']).photos.count(), 3)

    def test_refreshes_expired_access_before_complaint_submission(self):
        self.client.force_authenticate(user=None)
        refresh = RefreshToken.for_user(self.citizen)
        expired_access = refresh.access_token
        expired_access.set_exp(lifetime=timedelta(seconds=-1))
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {expired_access}')
        expired_response = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(expired_response.status_code, status.HTTP_401_UNAUTHORIZED)

        refreshed = self.client.post(reverse('cep:token-refresh'), {'refresh': str(refresh)}, format='json')
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
        created = self.client.post(self.url, self.payload(), format='multipart')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
