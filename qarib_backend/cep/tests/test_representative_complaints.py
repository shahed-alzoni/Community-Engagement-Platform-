import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from cep.models import Complaint, Organization, OrganizationCategory, OrganizationRepresentativeAssignment, User


PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20


class RepresentativeComplaintInboxTests(APITestCase):
    def setUp(self):
        self.water = Organization.objects.create(name='Water')
        self.roads = Organization.objects.create(name='Roads')
        self.water_category = OrganizationCategory.objects.create(organization=self.water, name='Water leak', image='water.png')
        self.water_rep = User.objects.create_user(full_name='Water Rep', email='water-inbox@example.com', phone_number='0991122301', password='StrongPass!2026', role=User.Role.ORGANIZATION_REPRESENTATIVE)
        self.roads_rep = User.objects.create_user(full_name='Roads Rep', email='roads-inbox@example.com', phone_number='0991122302', password='StrongPass!2026', role=User.Role.ORGANIZATION_REPRESENTATIVE)
        self.citizen = User.objects.create_user(full_name='Citizen', email='citizen-inbox@example.com', phone_number='0991122303', password='StrongPass!2026')
        self.water_assignment = OrganizationRepresentativeAssignment.objects.create(representative=self.water_rep, organization=self.water)
        OrganizationRepresentativeAssignment.objects.create(representative=self.roads_rep, organization=self.roads)
        self.list_url = reverse('cep:representative-complaints')

    def submit(self, organization, category=None, photo=None):
        self.client.force_authenticate(self.citizen)
        payload = {
            'organization': organization.pk,
            'title': 'Issue', 'description': 'Details of the issue',
            'latitude': '33.513800', 'longitude': '36.276500',
        }
        if category:
            payload['category'] = category.pk
        if photo:
            payload['photos'] = [photo]
        response = self.client.post(reverse('cep:citizen-complaints'), payload, format='multipart')
        self.assertEqual(response.status_code, 201)
        return response.data

    def test_each_representative_sees_only_their_organization_and_category(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            water = self.submit(self.water, self.water_category, SimpleUploadedFile('evidence.png', PNG, content_type='image/png'))
            roads = self.submit(self.roads)
            self.assertEqual(Complaint.objects.get(pk=water['id']).assigned_representative_id, self.water_rep.pk)

            self.client.force_authenticate(self.water_rep)
            inbox = self.client.get(self.list_url)
            self.assertEqual(inbox.status_code, 200)
            self.assertEqual([item['id'] for item in inbox.data], [water['id']])
            self.assertEqual(inbox.data[0]['organization_name'], 'Water leak')
            detail_url = reverse('cep:representative-complaint-detail', kwargs={'pk': water['id']})
            self.assertEqual(self.client.get(detail_url).status_code, 200)
            photo_url = reverse('cep:representative-complaint-photo', kwargs={'pk': water['id'], 'photo_id': water['photos'][0]['id']})
            photo_response = self.client.get(photo_url)
            self.assertEqual(photo_response.status_code, 200)
            photo_response.close()
            self.assertEqual(self.client.get(reverse('cep:representative-complaint-detail', kwargs={'pk': roads['id']})).status_code, 404)

            self.client.force_authenticate(self.roads_rep)
            self.assertEqual([item['id'] for item in self.client.get(self.list_url).data], [roads['id']])
            self.assertEqual(self.client.get(photo_url).status_code, 404)

    def test_current_representative_can_access_existing_organization_complaints(self):
        water = self.submit(self.water, self.water_category)
        self.water_assignment.ended_at = timezone.now()
        self.water_assignment.save(update_fields=['ended_at'])
        replacement = User.objects.create_user(full_name='Replacement', email='replacement-inbox@example.com', phone_number='0991122304', password='StrongPass!2026', role=User.Role.ORGANIZATION_REPRESENTATIVE)
        OrganizationRepresentativeAssignment.objects.create(representative=replacement, organization=self.water)

        self.client.force_authenticate(replacement)
        self.assertEqual([item['id'] for item in self.client.get(self.list_url).data], [water['id']])
        self.client.force_authenticate(self.water_rep)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)

    def test_citizen_inactive_representative_and_unassigned_representative_cannot_view_inbox(self):
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.water_rep.is_active = False
        self.water_rep.save(update_fields=['is_active'])
        self.client.force_authenticate(self.water_rep)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        unassigned = User.objects.create_user(full_name='Unassigned', email='unassigned-inbox@example.com', phone_number='0991122305', password='StrongPass!2026', role=User.Role.ORGANIZATION_REPRESENTATIVE)
        self.client.force_authenticate(unassigned)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)

    def test_representative_changes_status_and_citizen_sees_history(self):
        created = self.submit(self.water, self.water_category)
        url = reverse('cep:representative-complaint-status', kwargs={'pk': created['id']})
        self.client.force_authenticate(self.water_rep)
        started = self.client.patch(url, {'status': 'in_progress', 'note': 'Inspection started.'}, format='json')
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.data['status'], Complaint.Status.IN_PROGRESS)
        event = Complaint.objects.get(pk=created['id']).status_events.last()
        self.assertEqual(event.actor, self.water_rep)
        self.assertEqual(event.note, 'Inspection started.')
        resolved = self.client.patch(url, {'status': 'resolved'}, format='json')
        self.assertEqual(resolved.status_code, 200)
        self.assertEqual(resolved.data['status'], Complaint.Status.RESOLVED)
        self.assertEqual(self.client.patch(url, {'status': 'rejected', 'note': 'No'}, format='json').status_code, 400)
        self.client.force_authenticate(self.citizen)
        detail = self.client.get(reverse('cep:citizen-complaint-detail', kwargs={'pk': created['id']}))
        self.assertEqual([event['status'] for event in detail.data['status_events']], ['pending', 'in_progress', 'resolved'])

    def test_rejection_requires_reason_and_other_organization_cannot_change_status(self):
        created = self.submit(self.water, self.water_category)
        url = reverse('cep:representative-complaint-status', kwargs={'pk': created['id']})
        self.client.force_authenticate(self.roads_rep)
        self.assertEqual(self.client.patch(url, {'status': 'in_progress'}, format='json').status_code, 404)
        self.client.force_authenticate(self.water_rep)
        missing_reason = self.client.patch(url, {'status': 'rejected', 'note': '   '}, format='json')
        self.assertEqual(missing_reason.status_code, 400)
        self.assertIn('note', missing_reason.data)
        self.assertEqual(self.client.patch(url, {'status': 'resolved'}, format='json').status_code, 400)
        rejected = self.client.patch(url, {'status': 'rejected', 'note': 'Outside this organization’s responsibility.'}, format='json')
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data['status'], Complaint.Status.REJECTED)
        self.assertEqual(rejected.data['status_events'][-1]['note'], 'Outside this organization’s responsibility.')
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.patch(url, {'status': 'in_progress'}, format='json').status_code, 403)

    def test_resolution_photos_are_optional_validated_and_private(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            created = self.submit(self.water, self.water_category)
            url = reverse('cep:representative-complaint-status', kwargs={'pk': created['id']})
            self.client.force_authenticate(self.water_rep)
            self.assertEqual(self.client.patch(url, {'status': 'in_progress'}, format='json').status_code, 200)
            invalid = self.client.patch(url, {'status': 'resolved', 'resolution_photos': [SimpleUploadedFile('bad.png', b'not an image', content_type='image/png')]}, format='multipart')
            self.assertEqual(invalid.status_code, 400)
            self.assertEqual(Complaint.objects.get(pk=created['id']).status, Complaint.Status.IN_PROGRESS)
            rejected_photo = self.client.patch(url, {'status': 'rejected', 'note': 'Wrong organization', 'resolution_photos': [SimpleUploadedFile('proof.png', PNG, content_type='image/png')]}, format='multipart')
            self.assertEqual(rejected_photo.status_code, 400)
            photos = [SimpleUploadedFile(f'solution-{index}.png', PNG, content_type='image/png') for index in range(2)]
            resolved = self.client.patch(url, {'status': 'resolved', 'note': 'Leak fixed', 'resolution_photos': photos}, format='multipart')
            self.assertEqual(resolved.status_code, 200)
            event = resolved.data['status_events'][-1]
            self.assertEqual(len(event['resolution_photos']), 2)
            photo_id = event['resolution_photos'][0]['id']
            citizen_photo_url = reverse('cep:citizen-resolution-photo', kwargs={'pk': created['id'], 'photo_id': photo_id})
            representative_photo_url = reverse('cep:representative-resolution-photo', kwargs={'pk': created['id'], 'photo_id': photo_id})
            self.assertEqual(self.client.get(representative_photo_url).status_code, 200)
            self.client.force_authenticate(self.roads_rep)
            self.assertEqual(self.client.get(representative_photo_url).status_code, 404)
            self.client.force_authenticate(self.citizen)
            citizen_detail = self.client.get(reverse('cep:citizen-complaint-detail', kwargs={'pk': created['id']}))
            self.assertEqual(len(citizen_detail.data['status_events'][-1]['resolution_photos']), 2)
            citizen_photo = self.client.get(citizen_photo_url)
            self.assertEqual(citizen_photo.status_code, 200)
            citizen_photo.close()
            other_citizen = User.objects.create_user(full_name='Other', email='other-resolution@example.com', phone_number='0991122306', password='StrongPass!2026')
            self.client.force_authenticate(other_citizen)
            self.assertEqual(self.client.get(citizen_photo_url).status_code, 404)
