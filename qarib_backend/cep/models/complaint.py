import secrets
import uuid

from django.conf import settings
from django.db import models

from .organization import Organization
from .organization_category import OrganizationCategory


def complaint_reference():
    return f"QAR-{secrets.token_hex(6).upper()}"


def complaint_photo_path(instance, filename):
    extension = filename.rsplit('.', 1)[-1].lower()
    return f"complaints/{instance.complaint_id}/{uuid.uuid4().hex}.{extension}"


def resolution_photo_path(instance, filename):
    extension = filename.rsplit('.', 1)[-1].lower()
    return f"complaints/{instance.status_event.complaint_id}/resolution/{uuid.uuid4().hex}.{extension}"


class Complaint(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In progress'
        RESOLVED = 'resolved', 'Resolved'
        REJECTED = 'rejected', 'Rejected'

    reference = models.CharField(max_length=16, unique=True, default=complaint_reference, editable=False)
    citizen = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='complaints')
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='complaints')
    category = models.ForeignKey(OrganizationCategory, on_delete=models.PROTECT, null=True, blank=True, related_name='complaints')
    category_name_at_submission = models.CharField(max_length=150, blank=True)
    assigned_representative = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_complaints',
    )
    title = models.CharField(max_length=160)
    description = models.TextField()
    location_label = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'complaints'
        ordering = ['-created_at']


class ComplaintPhoto(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='photos')
    file = models.FileField(upload_to=complaint_photo_path)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'complaint_photos'


class ComplaintStatusEvent(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='status_events')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaint_status_actions')
    status = models.CharField(max_length=24, choices=Complaint.Status.choices)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'complaint_status_events'
        ordering = ['created_at', 'id']


class ComplaintTransferEvent(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='transfer_events')
    from_organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='+')
    to_organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='+')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='complaint_transfers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'complaint_transfer_events'
        ordering = ['created_at', 'id']


class ComplaintResolutionPhoto(models.Model):
    status_event = models.ForeignKey(ComplaintStatusEvent, on_delete=models.CASCADE, related_name='resolution_photos')
    file = models.FileField(upload_to=resolution_photo_path)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'complaint_resolution_photos'
