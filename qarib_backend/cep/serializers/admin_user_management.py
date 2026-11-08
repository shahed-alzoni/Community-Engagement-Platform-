from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from cep.models import Organization, User
from cep.services import AdminUserManagementService


class AdminUserCreateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(
        choices=(
            User.Role.CITIZEN,
            User.Role.ORGANIZATION_REPRESENTATIVE,
        )
    )
    email = serializers.EmailField(
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    phone_number = serializers.CharField(
        max_length=10,
        validators=[UniqueValidator(queryset=User.objects.all())],
    )
    password = serializers.CharField(write_only=True, validators=[validate_password])
    organization_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=False,
        allow_null=True,
        write_only=True,
    )
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "email",
            "phone_number",
            "password",
            "role",
            "organization_name",
            "organization_id",
            "is_active",
            "must_change_password",
            "created_at",
        )
        read_only_fields = ("id", "is_active", "must_change_password", "created_at")

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_phone_number(self, value: str) -> str:
        normalized_number = User.objects.normalize_phone_number(value)
        phone_field = User._meta.get_field("phone_number")
        for validator in phone_field.validators:
            validator(normalized_number)
        return normalized_number

    def validate(self, attrs):
        role = attrs["role"]
        organization_name = attrs.get("organization_name")
        organization = attrs.pop("organization", None)

        if role == User.Role.ORGANIZATION_REPRESENTATIVE:
            if bool(organization_name) == bool(organization):
                raise serializers.ValidationError(
                    {
                        "organization_name": (
                            "Choose one available organization or enter one new organization name."
                        )
                    }
                )
            if organization is not None:
                if hasattr(organization, "active_representative_assignment"):
                    raise serializers.ValidationError(
                        {"organization_id": "This organization already has an active representative."}
                    )
                attrs["organization_id"] = organization.pk
            else:
                normalized_name = Organization.normalize_name(organization_name)
                organization_key = normalized_name.casefold()
                if Organization.objects.filter(
                    normalized_name=organization_key,
                    active_representative_assignment__isnull=False,
                ).exists():
                    raise serializers.ValidationError(
                        {"organization_name": "This organization already has an active representative."}
                    )
                attrs["organization_name"] = normalized_name
        elif organization_name is not None or organization is not None:
            raise serializers.ValidationError(
                {"organization_name": "Organization name is only allowed for representatives."}
            )
        return attrs

    def create(self, validated_data):
        return AdminUserManagementService.create_user(**validated_data)


class AdminManagedUserSerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    organization_id = serializers.SerializerMethodField()

    def latest_assignment(self, user):
        if hasattr(user, "prefetched_assignments"):
            return user.prefetched_assignments[0] if user.prefetched_assignments else None
        return (
            user.organization_assignments.select_related("organization")
            .order_by("-assigned_at")
            .first()
        )

    def get_organization_name(self, user):
        assignment = self.latest_assignment(user)
        return assignment.organization.name if assignment else None

    def get_organization_id(self, user):
        assignment = self.latest_assignment(user)
        return assignment.organization_id if assignment else None

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "email",
            "phone_number",
            "role",
            "organization_name",
            "organization_id",
            "is_active",
            "must_change_password",
            "created_at",
            "updated_at",
        )


class AdminUserDetailSerializer(AdminManagedUserSerializer):
    assignment_history = serializers.SerializerMethodField()

    def get_assignment_history(self, user):
        assignments = user.organization_assignments.select_related("organization").order_by(
            "-assigned_at"
        )
        return [
            {
                "id": assignment.pk,
                "organization_id": assignment.organization_id,
                "organization_name": assignment.organization.name,
                "assigned_at": assignment.assigned_at,
                "ended_at": assignment.ended_at,
                "is_active": assignment.ended_at is None,
            }
            for assignment in assignments
        ]

    class Meta(AdminManagedUserSerializer.Meta):
        fields = AdminManagedUserSerializer.Meta.fields + (
            "last_login",
            "assignment_history",
        )


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = User
        fields = ("full_name", "email", "phone_number", "organization_id")

    def validate_email(self, value: str) -> str:
        if self.instance.role != User.Role.SYSTEM_ADMIN:
            raise serializers.ValidationError("Email address cannot be changed for this account.")
        normalized_email = value.strip().lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email=normalized_email).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return normalized_email

    def validate_phone_number(self, value: str) -> str:
        normalized_number = User.objects.normalize_phone_number(value)
        phone_field = User._meta.get_field("phone_number")
        for validator in phone_field.validators:
            validator(normalized_number)
        if User.objects.exclude(pk=self.instance.pk).filter(
            phone_number=normalized_number
        ).exists():
            raise serializers.ValidationError("This mobile number is already in use.")
        return normalized_number

    def validate(self, attrs):
        organization = attrs.pop("organization", None)
        if organization is not None:
            if self.instance.role != User.Role.ORGANIZATION_REPRESENTATIVE:
                raise serializers.ValidationError(
                    {"organization_id": "Only representatives can be assigned to an organization."}
                )
            active_assignment = getattr(
                organization, "active_representative_assignment", None
            )
            if active_assignment is not None and active_assignment.representative_id != self.instance.pk:
                raise serializers.ValidationError(
                    {"organization_id": "This organization already has an active representative."}
                )
            attrs["organization_id"] = organization.pk
        return attrs

    def update(self, instance, validated_data):
        return AdminUserManagementService.update_user(user=instance, **validated_data)


class AdminUserStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class AvailableOrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "created_at")
