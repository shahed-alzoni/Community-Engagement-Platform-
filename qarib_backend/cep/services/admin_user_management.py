from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from django.utils import timezone

from cep.models import Organization, OrganizationRepresentativeAssignment, User


class AdminUserManagementService:
    @staticmethod
    def _latest_assignment(user: User):
        return user.organization_assignments.select_related("organization").order_by(
            "-assigned_at"
        ).first()

    @staticmethod
    @transaction.atomic
    def create_user(
        *,
        full_name: str,
        email: str,
        phone_number: str,
        password: str,
        role: str,
        organization_name: str | None = None,
        organization_id: int | None = None,
    ) -> User:
        try:
            user = User.objects.create_user(
                full_name=full_name,
                email=email,
                phone_number=phone_number,
                password=password,
                role=role,
                must_change_password=(role == User.Role.ORGANIZATION_REPRESENTATIVE),
            )
            if role == User.Role.ORGANIZATION_REPRESENTATIVE:
                if organization_id is not None:
                    organization = Organization.objects.select_for_update().get(pk=organization_id)
                    if hasattr(organization, "active_representative_assignment"):
                        raise ValidationError(
                            {"organization_id": "This organization already has an active representative."}
                        )
                else:
                    normalized_name = Organization.normalize_name(organization_name or "")
                    organization, _ = Organization.objects.get_or_create(
                        normalized_name=normalized_name.casefold(),
                        defaults={"name": normalized_name},
                    )
                OrganizationRepresentativeAssignment.objects.create(
                    representative=user,
                    organization=organization,
                )
            return user
        except IntegrityError as error:
            if role == User.Role.ORGANIZATION_REPRESENTATIVE:
                raise ValidationError(
                    {"organization_name": "This organization already has an active representative."}
                ) from error
            raise

    @staticmethod
    @transaction.atomic
    def deactivate_user(*, user: User) -> User:
        if user.role == User.Role.SYSTEM_ADMIN:
            raise ValidationError({"detail": "The System Admin account cannot be deactivated."})

        if user.is_active:
            if user.role == User.Role.ORGANIZATION_REPRESENTATIVE:
                assignment = (
                    user.organization_assignments.filter(ended_at__isnull=True)
                    .select_for_update()
                    .first()
                )
                if assignment is not None:
                    assignment.ended_at = timezone.now()
                    assignment.save(update_fields=["ended_at"])
            user.is_active = False
            user.save(update_fields=["is_active", "updated_at"])
        return user

    @staticmethod
    @transaction.atomic
    def set_active_status(*, user: User, is_active: bool) -> User:
        if user.role == User.Role.SYSTEM_ADMIN and not is_active:
            raise ValidationError({"is_active": "The System Admin account cannot be deactivated."})
        if user.is_active == is_active:
            return user
        if not is_active:
            return AdminUserManagementService.deactivate_user(user=user)

        if user.role == User.Role.ORGANIZATION_REPRESENTATIVE:
            latest_assignment = AdminUserManagementService._latest_assignment(user)
            if latest_assignment is None:
                raise ValidationError(
                    {"organization_id": "Assign an organization before activating this representative."}
                )
            organization = Organization.objects.select_for_update().get(
                pk=latest_assignment.organization_id
            )
            if hasattr(organization, "active_representative_assignment"):
                raise ValidationError(
                    {"organization_id": "This organization already has an active representative."}
                )
            OrganizationRepresentativeAssignment.objects.create(
                representative=user,
                organization=organization,
            )
        user.is_active = True
        user.save(update_fields=["is_active", "updated_at"])
        return user

    @staticmethod
    @transaction.atomic
    def update_user(
        *,
        user: User,
        full_name: str | None = None,
        email: str | None = None,
        phone_number: str | None = None,
        organization_id: int | None = None,
    ) -> User:
        updated_fields = ["updated_at"]
        if full_name is not None:
            user.full_name = full_name
            updated_fields.append("full_name")
        if email is not None and user.role == User.Role.SYSTEM_ADMIN:
            user.email = email
            updated_fields.append("email")
        if phone_number is not None:
            user.phone_number = phone_number
            updated_fields.append("phone_number")

        if user.role == User.Role.ORGANIZATION_REPRESENTATIVE and organization_id is not None:
            organization = Organization.objects.select_for_update().get(pk=organization_id)
            current_assignment = user.organization_assignments.filter(
                ended_at__isnull=True
            ).select_for_update().first()
            latest_assignment = current_assignment or AdminUserManagementService._latest_assignment(user)

            if latest_assignment is None or latest_assignment.organization_id != organization.pk:
                active_assignment = getattr(
                    organization, "active_representative_assignment", None
                )
                if active_assignment is not None and active_assignment.representative_id != user.pk:
                    raise ValidationError(
                        {"organization_id": "This organization already has an active representative."}
                    )
                if current_assignment is not None:
                    current_assignment.ended_at = timezone.now()
                    current_assignment.save(update_fields=["ended_at"])
                if user.is_active:
                    OrganizationRepresentativeAssignment.objects.create(
                        representative=user,
                        organization=organization,
                    )
                else:
                    now = timezone.now()
                    OrganizationRepresentativeAssignment.objects.create(
                        representative=user,
                        organization=organization,
                        ended_at=now,
                    )

        user.save(update_fields=updated_fields)
        return user
