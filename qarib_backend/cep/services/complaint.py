from django.db import transaction
from rest_framework.exceptions import ValidationError

from cep.models import Complaint, ComplaintPhoto, ComplaintResolutionPhoto, ComplaintStatusEvent, ComplaintTransferEvent, OrganizationRepresentativeAssignment


class ComplaintService:
    @staticmethod
    @transaction.atomic
    def transfer(*, complaint_id, representative, destination):
        assignment = representative.active_organization_assignment
        complaint = Complaint.objects.select_for_update().filter(
            pk=complaint_id, organization_id=assignment.organization_id,
        ).first()
        if complaint is None:
            return None
        if complaint.status not in {Complaint.Status.PENDING, Complaint.Status.IN_PROGRESS}:
            raise ValidationError({'detail': 'Only open complaints can be transferred.'})
        if destination.pk == complaint.organization_id:
            raise ValidationError({'organization': 'Choose another organization.'})

        previous_organization = complaint.organization
        target_assignment = OrganizationRepresentativeAssignment.objects.filter(
            organization=destination, ended_at__isnull=True, representative__is_active=True,
        ).select_related('representative').first()
        complaint.organization = destination
        complaint.category = None
        complaint.assigned_representative = target_assignment.representative if target_assignment else None
        complaint.status = Complaint.Status.PENDING
        complaint.save(update_fields=['organization', 'category', 'assigned_representative', 'status', 'updated_at'])
        ComplaintTransferEvent.objects.create(
            complaint=complaint, from_organization=previous_organization,
            to_organization=destination, actor=representative,
        )
        ComplaintStatusEvent.objects.create(
            complaint=complaint, status=Complaint.Status.PENDING,
            actor=representative, note='Complaint transferred to another organization.',
        )
        return complaint

    @staticmethod
    def create(*, citizen, organization, title, description, latitude, longitude, location_label='', photos=(), category=None):
        assignment = OrganizationRepresentativeAssignment.objects.filter(
            organization=organization,
            ended_at__isnull=True,
            representative__is_active=True,
        ).select_related('representative').first()
        status = Complaint.Status.PENDING
        with transaction.atomic():
            complaint = Complaint.objects.create(
                citizen=citizen, organization=organization, category=category,
                category_name_at_submission=category.name if category else organization.citizen_display_name,
                assigned_representative=assignment.representative if assignment else None,
                title=title, description=description, latitude=latitude, longitude=longitude,
                location_label=location_label, status=status,
            )
            ComplaintStatusEvent.objects.create(complaint=complaint, status=status, actor=citizen)
            for photo in photos:
                ComplaintPhoto.objects.create(complaint=complaint, file=photo)
        return complaint

    @staticmethod
    @transaction.atomic
    def change_status(*, complaint_id, representative, status, note='', resolution_photos=()):
        assignment = representative.active_organization_assignment
        complaint = Complaint.objects.select_for_update().filter(
            pk=complaint_id, organization_id=assignment.organization_id,
        ).first()
        if complaint is None:
            return None
        allowed = {
            Complaint.Status.PENDING: {Complaint.Status.IN_PROGRESS, Complaint.Status.REJECTED},
            Complaint.Status.IN_PROGRESS: {Complaint.Status.RESOLVED, Complaint.Status.REJECTED},
        }
        if status not in allowed.get(complaint.status, set()):
            raise ValidationError({'status': 'This status change is not allowed.'})
        complaint.status = status
        complaint.save(update_fields=['status', 'updated_at'])
        event = ComplaintStatusEvent.objects.create(complaint=complaint, status=status, note=note, actor=representative)
        for photo in resolution_photos:
            ComplaintResolutionPhoto.objects.create(status_event=event, file=photo)
        return complaint
