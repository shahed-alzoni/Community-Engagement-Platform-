from django.conf import settings
from django.db import models
from django.db.models import F, Q

from cep.models.organization import Organization


class OrganizationRepresentativeAssignment(models.Model):
    representative = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="organization_assignments",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="representative_assignments",
    )
    active_representative = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        editable=False,
        related_name="active_organization_assignment",
    )
    active_organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        editable=False,
        related_name="active_representative_assignment",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "organization_representative_assignments"
        ordering = ["-assigned_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        Q(ended_at__isnull=True)
                        & Q(active_representative=F("representative"))
                        & Q(active_organization=F("organization"))
                    )
                    | (
                        Q(ended_at__isnull=False)
                        & Q(active_representative__isnull=True)
                        & Q(active_organization__isnull=True)
                    )
                ),
                name="valid_active_org_rep_assignment",
            )
        ]

    def save(self, *args, **kwargs):
        if self.ended_at is None:
            self.active_representative_id = self.representative_id
            self.active_organization_id = self.organization_id
        else:
            self.active_representative_id = None
            self.active_organization_id = None

        if kwargs.get("update_fields") is not None:
            kwargs["update_fields"] = set(kwargs["update_fields"]) | {
                "active_representative",
                "active_organization",
            }
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.representative} → {self.organization}"
