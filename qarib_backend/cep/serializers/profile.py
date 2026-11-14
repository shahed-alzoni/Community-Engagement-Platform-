from rest_framework import serializers

from cep.models import OrganizationCategory, User
from cep.services import ProfileService


class ProfileSerializer(serializers.ModelSerializer):
    organization_id = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()
    organization_display_name = serializers.SerializerMethodField()
    organization_image_version = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "full_name", "email", "phone_number", "role",
            "organization_id", "organization_name", "organization_display_name", "organization_image_version", "created_at",
        )
        read_only_fields = fields

    def _assignment(self, user):
        return getattr(user, "active_organization_assignment", None)

    def get_organization_id(self, user):
        assignment = self._assignment(user)
        return assignment.organization_id if assignment else None

    def get_organization_name(self, user):
        assignment = self._assignment(user)
        return assignment.organization.name if assignment else None

    def get_organization_display_name(self, user):
        assignment = self._assignment(user)
        return assignment.organization.citizen_display_name if assignment else None

    def get_organization_image_version(self, user):
        assignment = self._assignment(user)
        organization = assignment.organization if assignment else None
        return organization.updated_at.isoformat() if organization and organization.image else None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    organization_display_name = serializers.CharField(max_length=150, required=False, trim_whitespace=True)

    class Meta:
        model = User
        fields = ("full_name", "email", "phone_number", "organization_display_name")

    def validate_organization_display_name(self, value):
        if not value:
            raise serializers.ValidationError("Enter a name to show citizens.")
        if self.instance.role != User.Role.ORGANIZATION_REPRESENTATIVE or not getattr(self.instance, "active_organization_assignment", None):
            raise serializers.ValidationError("Only an assigned organization representative can change this name.")
        organization = self.instance.active_organization_assignment.organization
        if OrganizationCategory.objects.filter(organization=organization, name__iexact=value).exists():
            raise serializers.ValidationError("This name is already used by your organization.")
        return value

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email=normalized).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return normalized

    def validate_phone_number(self, value):
        normalized = User.objects.normalize_phone_number(value)
        phone_field = User._meta.get_field("phone_number")
        for validator in phone_field.validators:
            validator(normalized)
        if User.objects.exclude(pk=self.instance.pk).filter(phone_number=normalized).exists():
            raise serializers.ValidationError("This mobile number is already in use.")
        return normalized

    def update(self, instance, validated_data):
        display_name = validated_data.pop("organization_display_name", None)
        return ProfileService.update(user=instance, organization_display_name=display_name, **validated_data)
