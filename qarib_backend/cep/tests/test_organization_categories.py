import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from cep.models import Complaint, Organization, OrganizationCategory, OrganizationRepresentativeAssignment, User


PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20


class OrganizationCategoryTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name='Water')
        self.other_organization = Organization.objects.create(name='Roads')
        self.representative = User.objects.create_user(full_name='Water Rep', email='category-rep@example.com', phone_number='0991122334', password='StrongPass!2026', role=User.Role.ORGANIZATION_REPRESENTATIVE)
        OrganizationRepresentativeAssignment.objects.create(representative=self.representative, organization=self.organization)
        self.citizen = User.objects.create_user(full_name='Citizen', email='category-citizen@example.com', phone_number='0991122335', password='StrongPass!2026')
        self.url = reverse('cep:organization-categories')

    def image(self):
        return SimpleUploadedFile('category.png', PNG, content_type='image/png')

    def test_representative_adds_and_edits_categories_and_citizen_selects_one(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(self.representative)
            created = self.client.post(self.url, {'name': 'Water leak', 'image': self.image()}, format='multipart')
            self.assertEqual(created.status_code, 201)
            category_id = created.data['id']
            self.assertEqual(len(self.client.get(self.url).data), 1)
            updated = self.client.patch(reverse('cep:organization-category-update', kwargs={'pk': category_id}), {'name': 'Water supply'}, format='multipart')
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.data['name'], 'Water supply')
            image_response = self.client.get(reverse('cep:organization-category-image', kwargs={'pk': category_id}))
            self.assertEqual(image_response.status_code, 200)
            b''.join(image_response.streaming_content)

            self.client.force_authenticate(self.citizen)
            options = self.client.get(reverse('cep:complaint-organizations')).data
            self.assertEqual(len(options), 3)
            self.assertEqual(options[-1]['category_id'], category_id)
            self.assertEqual(options[-1]['name'], 'Water supply')
            submitted = self.client.post(reverse('cep:citizen-complaints'), {
                'organization': self.organization.pk, 'category': category_id,
                'title': 'No water', 'description': 'No water in the street',
                'latitude': '33.513800', 'longitude': '36.276500',
            }, format='multipart')
            self.assertEqual(submitted.status_code, 201)
            self.assertEqual(submitted.data['organization_name'], 'Water supply')
            self.assertEqual(Complaint.objects.get(pk=submitted.data['id']).category_id, category_id)
            self.assertEqual(Complaint.objects.get(pk=submitted.data['id']).category_name_at_submission, 'Water supply')

            self.client.force_authenticate(self.representative)
            self.client.patch(reverse('cep:organization-category-update', kwargs={'pk': category_id}), {'name': 'Pipe problems'}, format='multipart')
            self.client.force_authenticate(self.citizen)
            historical = self.client.get(reverse('cep:citizen-complaint-detail', kwargs={'pk': submitted.data['id']}))
            self.assertEqual(historical.data['organization_name'], 'Water supply')

    def test_category_requires_image_and_cannot_be_managed_by_citizen_or_other_representative(self):
        self.client.force_authenticate(self.representative)
        missing_image = self.client.post(self.url, {'name': 'Water leak'}, format='multipart')
        self.assertEqual(missing_image.status_code, 400)
        self.assertIn('image', missing_image.data)
        category = OrganizationCategory.objects.create(organization=self.other_organization, name='Road damage', image='roads.png')
        forbidden_edit = self.client.patch(reverse('cep:organization-category-update', kwargs={'pk': category.pk}), {'name': 'Changed'}, format='multipart')
        self.assertEqual(forbidden_edit.status_code, 404)
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        mismatch = self.client.post(reverse('cep:citizen-complaints'), {
            'organization': self.organization.pk, 'category': category.pk,
            'title': 'Issue', 'description': 'Description', 'latitude': '33.513800', 'longitude': '36.276500',
        }, format='multipart')
        self.assertEqual(mismatch.status_code, 400)
        self.assertIn('category', mismatch.data)

    def test_primary_organization_option_accepts_empty_category_from_form(self):
        self.client.force_authenticate(self.citizen)
        submitted = self.client.post(reverse('cep:citizen-complaints'), {
            'organization': self.organization.pk, 'category': '',
            'title': 'Water issue', 'description': 'Water issue in the street',
            'latitude': '33.513800', 'longitude': '36.276500',
        }, format='multipart')
        self.assertEqual(submitted.status_code, 201)
        self.assertIsNone(Complaint.objects.get(pk=submitted.data['id']).category_id)
        self.assertEqual(Complaint.objects.get(pk=submitted.data['id']).category_name_at_submission, 'Water')
