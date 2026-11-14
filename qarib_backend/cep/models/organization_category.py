import uuid

from django.db import models

from .organization import Organization


def category_image_path(instance, filename):
    extension = filename.rsplit('.', 1)[-1].lower()
    return f"organizations/{instance.organization_id}/categories/{uuid.uuid4().hex}.{extension}"


class OrganizationCategory(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='categories')
    name = models.CharField(max_length=150)
    image = models.FileField(upload_to=category_image_path)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organization_categories'
        ordering = ['created_at', 'id']

    def __str__(self):
        return self.name
