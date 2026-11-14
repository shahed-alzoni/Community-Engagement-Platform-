import uuid

from django.db import models


def organization_image_path(instance, filename):
    extension = filename.rsplit('.', 1)[-1].lower()
    return f"organizations/{instance.pk}/{uuid.uuid4().hex}.{extension}"


class Organization(models.Model):
    name = models.CharField(max_length=150)
    display_name = models.CharField(max_length=150, blank=True)
    normalized_name = models.CharField(max_length=150, unique=True, editable=False)
    image = models.FileField(upload_to=organization_image_path, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        ordering = ["name"]

    @staticmethod
    def normalize_name(value: str) -> str:
        return " ".join(value.split())

    def save(self, *args, **kwargs):
        self.name = self.normalize_name(self.name)
        self.normalized_name = self.name.casefold()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

    @property
    def citizen_display_name(self) -> str:
        return self.display_name or self.name
